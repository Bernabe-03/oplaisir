import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateSupportDto, SupportTheme, SupportType, SupportStatus } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { SupportResponseDto } from './dto/support-response.dto';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { Express } from 'express';

@Injectable()
export class SupportsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // ------------------------------------------------------------
  // GÉNÉRATION DU SKU
  // ------------------------------------------------------------
  private async generateNextSku(): Promise<string> {
    const last = await this.prisma.support.findFirst({
      where: { sku: { startsWith: 'SUP-' } },
      orderBy: { createdAt: 'desc' },
      select: { sku: true },
    });

    let next = 1;
    if (last?.sku) {
      const match = last.sku.match(/SUP-(\d+)/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `SUP-${next.toString().padStart(5, '0')}`;
  }

  // ------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------
  async create(createSupportDto: CreateSupportDto, userId?: string): Promise<SupportResponseDto> {
    let sku = createSupportDto.sku?.trim();
    if (!sku) {
      sku = await this.generateNextSku();
    }

    const existing = await this.prisma.support.findFirst({ where: { sku } });
    if (existing) {
      sku = await this.generateNextSku();
    }

    const sellingPrice = createSupportDto.sellingPrice ?? 0;
    const purchasePrice = createSupportDto.purchasePrice ?? 0;
    if (sellingPrice < purchasePrice) {
      throw new BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
    }

    const supportData = {
      name: createSupportDto.name,
      description: createSupportDto.description,
      sku,
      type: createSupportDto.type,
      theme: createSupportDto.theme,
      material: createSupportDto.material,
      color: createSupportDto.color,
      dimensions: createSupportDto.dimensions,
      compatibleThemes: this.ensureArray(createSupportDto.compatibleThemes, []),
      capacity: createSupportDto.capacity ?? 1,
      weight: createSupportDto.weight ?? 0,
      weightUnit: createSupportDto.weightUnit ?? 'g',
      purchasePrice,
      sellingPrice,
      tva: createSupportDto.tva ?? 18,
      stock: createSupportDto.stock ?? 0,
      minStock: createSupportDto.minStock ?? 5,
      maxStock: createSupportDto.maxStock ?? 100,
      images: this.ensureArray(createSupportDto.images, []),
      status: createSupportDto.status ?? 'actif',
      userId,
    };

    const support = await this.prisma.support.create({
      data: supportData,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatSupportResponse(support);
  }

  // ------------------------------------------------------------
  // FIND ALL
  // ------------------------------------------------------------
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    theme?: SupportTheme,
    type?: SupportType,
    status?: SupportStatus,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (theme) where.theme = theme;
    if (type) where.type = type;
    if (status) where.status = status;

    const [supports, total] = await Promise.all([
      this.prisma.support.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.support.count({ where }),
    ]);

    return {
      data: supports.map((s) => this.formatSupportResponse(s)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ------------------------------------------------------------
  // FIND ONE
  // ------------------------------------------------------------
  async findOne(id: string): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    return this.formatSupportResponse(support);
  }

  // ------------------------------------------------------------
  // FIND BY SKU
  // ------------------------------------------------------------
  async findBySku(sku: string): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findFirst({
      where: { sku: { equals: sku } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!support) {
      throw new NotFoundException(`Support avec le SKU ${sku} non trouvé`);
    }

    return this.formatSupportResponse(support);
  }

  // ------------------------------------------------------------
  // UPDATE – CORRIGÉ : mise à jour partielle stricte
  // ------------------------------------------------------------
  async update(id: string, updateSupportDto: UpdateSupportDto): Promise<SupportResponseDto> {
    const existing = await this.prisma.support.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    // Vérifier l'unicité du SKU si modifié
    if (updateSupportDto.sku && updateSupportDto.sku !== existing.sku) {
      const skuExists = await this.prisma.support.findFirst({
        where: { sku: updateSupportDto.sku, NOT: { id } },
      });
      if (skuExists) {
        throw new BadRequestException('Un support avec ce SKU existe déjà');
      }
    }

    // Construction du payload – UNIQUEMENT les champs présents
    const updatePayload: any = {};

    const scalarFields = [
      'name', 'description', 'sku', 'type', 'theme', 'material',
      'color', 'dimensions', 'weightUnit', 'status',
    ];
    scalarFields.forEach((field) => {
      if (updateSupportDto[field] !== undefined) {
        updatePayload[field] = updateSupportDto[field];
      }
    });

    const numberFields = [
      'capacity', 'weight', 'purchasePrice', 'sellingPrice',
      'tva', 'stock', 'minStock', 'maxStock',
    ];
    numberFields.forEach((field) => {
      if (updateSupportDto[field] !== undefined) {
        const val = updateSupportDto[field];
        updatePayload[field] = val === null ? null : Number(val);
      }
    });

    // compatibleThemes – UNIQUEMENT si présent
    if (updateSupportDto.compatibleThemes !== undefined) {
      updatePayload.compatibleThemes = this.ensureArray(updateSupportDto.compatibleThemes, []);
    }

    // images – UNIQUEMENT si présent
    if (updateSupportDto.images !== undefined) {
      updatePayload.images = this.ensureArray(updateSupportDto.images, []);
    }

    // Vérifier la cohérence des prix après mise à jour
    const sellingPrice = updatePayload.sellingPrice ?? existing.sellingPrice;
    const purchasePrice = updatePayload.purchasePrice ?? existing.purchasePrice;
    if (sellingPrice < purchasePrice) {
      throw new BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
    }

    const updated = await this.prisma.support.update({
      where: { id },
      data: updatePayload,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatSupportResponse(updated);
  }

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.support.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    const salesCount = await this.prisma.saleItem.count({
      where: { supportId: id },
    });
    if (salesCount > 0) {
      throw new BadRequestException(
        'Ce support ne peut pas être supprimé car il est utilisé dans des ventes',
      );
    }

    // Supprimer les images de Cloudinary si nécessaire
    if (existing.images && existing.images.length > 0) {
      const publicIds = this.cloudinary.extractPublicIdsFromUrls(existing.images);
      if (publicIds.length > 0) {
        try {
          await this.cloudinary.deleteMultipleImages(publicIds);
        } catch (error) {
          console.error('Erreur suppression images Cloudinary:', error);
        }
      }
    }

    await this.prisma.support.delete({ where: { id } });
  }

  // ------------------------------------------------------------
  // UPLOAD IMAGE
  // ------------------------------------------------------------
  async uploadImage(id: string, file: Express.Multer.File): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findUnique({ where: { id } });
    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    try {
      const uploadResult = await this.cloudinary.uploadImage(file);
      const updated = await this.prisma.support.update({
        where: { id },
        data: {
          images: {
            push: uploadResult.secure_url,
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      return this.formatSupportResponse(updated);
    } catch (error) {
      console.error('Erreur upload image:', error);
      throw new BadRequestException('Erreur lors du téléchargement de l\'image');
    }
  }

  // ------------------------------------------------------------
  // REMOVE IMAGE
  // ------------------------------------------------------------
  async removeImage(id: string, imageUrl: string): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findUnique({ where: { id } });
    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    try {
      const publicId = this.cloudinary.extractPublicIdFromUrl(imageUrl);
      if (publicId) {
        await this.cloudinary.deleteImage(publicId);
      }
    } catch (error) {
      console.error('Erreur suppression image Cloudinary:', error);
    }

    const updated = await this.prisma.support.update({
      where: { id },
      data: {
        images: {
          set: support.images.filter((img) => img !== imageUrl),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatSupportResponse(updated);
  }

  // ------------------------------------------------------------
  // STATS
  // ------------------------------------------------------------
  async getStats() {
    const total = await this.prisma.support.count();
    const active = await this.prisma.support.count({ where: { status: 'actif' } });
    const totalStock = await this.prisma.support.aggregate({
      _sum: { stock: true },
    });
    const totalValue = await this.prisma.support.aggregate({
      _sum: { purchasePrice: true },
    });

    return {
      total,
      active,
      totalStock: totalStock._sum.stock || 0,
      totalValue: totalValue._sum.purchasePrice || 0,
    };
  }

  // ------------------------------------------------------------
  // LOW STOCK
  // ------------------------------------------------------------
  async getLowStock() {
    const supports = await this.prisma.support.findMany({
      where: {
        stock: { lte: this.prisma.support.fields.minStock },
        status: 'actif',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return supports.map((s) => this.formatSupportResponse(s));
  }

  // ------------------------------------------------------------
  // CATEGORIES (types)
  // ------------------------------------------------------------
  async getCategories() {
    const types = await this.prisma.support.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });

    return types.map((t) => ({
      name: t.type,
      count: t._count._all,
    }));
  }

  // ------------------------------------------------------------
  // FILTER BY THEME
  // ------------------------------------------------------------
  async filterByTheme(theme: string) {
    const supports = await this.prisma.support.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const filtered = supports.filter((support) => {
      const themes = (support.compatibleThemes as string[]) ?? [];
      return support.theme === theme || themes.includes(theme);
    });

    return filtered.map((s) => this.formatSupportResponse(s));
  }

  // ------------------------------------------------------------
  // UTILITAIRES PRIVÉES
  // ------------------------------------------------------------
  private formatSupportResponse(support: any): SupportResponseDto {
    let images: string[] = [];
    if (support.images) {
      if (Array.isArray(support.images)) {
        images = support.images;
      } else if (typeof support.images === 'string') {
        try {
          const parsed = JSON.parse(support.images);
          images = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          images = [support.images];
        }
      }
    }

    let compatibleThemes: string[] = [];
    if (support.compatibleThemes) {
      if (Array.isArray(support.compatibleThemes)) {
        compatibleThemes = support.compatibleThemes;
      } else if (typeof support.compatibleThemes === 'string') {
        try {
          const parsed = JSON.parse(support.compatibleThemes);
          compatibleThemes = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          compatibleThemes = [];
        }
      }
    }

    return {
      id: support.id,
      name: support.name,
      description: support.description,
      sku: support.sku,
      type: support.type,
      theme: support.theme,
      material: support.material,
      color: support.color,
      dimensions: support.dimensions,
      compatibleThemes,
      capacity: support.capacity,
      weight: support.weight ?? 0,
      weightUnit: support.weightUnit ?? 'g',
      purchasePrice: support.purchasePrice,
      sellingPrice: support.sellingPrice,
      tva: support.tva ?? 18,
      stock: support.stock,
      minStock: support.minStock,
      maxStock: support.maxStock,
      images,
      status: support.status,
      createdAt: support.createdAt,
      updatedAt: support.updatedAt,
      userId: support.userId,
    };
  }

  private ensureArray(value: any, defaultValue: any[] = []): any[] {
    if (value === undefined || value === null) return defaultValue;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : defaultValue;
      } catch {
        return [value];
      }
    }
    return defaultValue;
  }
}