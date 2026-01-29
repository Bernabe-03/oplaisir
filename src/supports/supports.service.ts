import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { SupportResponseDto } from './dto/support-response.dto';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { SupportStatus, SupportTheme, SupportType } from './dto/create-support.dto';

@Injectable()
export class SupportsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  // Méthode pour générer le prochain SKU séquentiel
  private async generateNextSku(): Promise<string> {
    const lastSupport = await this.prisma.support.findFirst({
      where: {
        sku: {
          startsWith: 'SUP-',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        sku: true,
      },
    });

    let nextNumber = 1;
    
    if (lastSupport && lastSupport.sku) {
      const match = lastSupport.sku.match(/SUP-(\d+)/);
      if (match && match[1]) {
        const lastNumber = parseInt(match[1], 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    return `SUP-${nextNumber.toString().padStart(5, '0')}`;
  }

  async create(createSupportDto: CreateSupportDto, userId?: string): Promise<SupportResponseDto> {
    let sku = createSupportDto.sku;
    if (!sku || sku.trim() === '') {
      sku = await this.generateNextSku();
      console.log(`🔢 SKU généré automatiquement: ${sku}`);
    }

    const existingSupport = await this.prisma.support.findFirst({
      where: { sku },
    });

    if (existingSupport) {
      console.log(`⚠️ SKU ${sku} existe déjà, régénération...`);
      sku = await this.generateNextSku();
      console.log(`🔢 Nouveau SKU généré: ${sku}`);
    }

    const sellingPrice = createSupportDto.sellingPrice ?? 0;
    const purchasePrice = createSupportDto.purchasePrice ?? 0;
    
    if (sellingPrice < purchasePrice) {
      throw new BadRequestException(
        "Le prix de vente doit être supérieur au prix d'achat",
      );
    }

    // Préparer les données en s'assurant que les tableaux sont corrects
    const supportData = {
      name: createSupportDto.name,
      description: createSupportDto.description,
      sku: sku,
      type: createSupportDto.type,
      theme: createSupportDto.theme,
      material: createSupportDto.material,
      color: createSupportDto.color,
      dimensions: createSupportDto.dimensions,
      compatibleThemes: this.ensureArray(createSupportDto.compatibleThemes, []),
      capacity: createSupportDto.capacity ?? 1,
      weight: createSupportDto.weight ?? 0,
      weightUnit: createSupportDto.weightUnit ?? 'g',
      purchasePrice: purchasePrice,
      sellingPrice: sellingPrice,
      tva: createSupportDto.tva ?? 18,
      stock: createSupportDto.stock ?? 0,
      minStock: createSupportDto.minStock ?? 5,
      maxStock: createSupportDto.maxStock ?? 100,
      images: this.ensureArray(createSupportDto.images, []),
      status: createSupportDto.status ?? 'actif',
      userId,
    };

    console.log('📦 Données de création du support:', {
      ...supportData,
      compatibleThemes: supportData.compatibleThemes,
      images: supportData.images,
    });

    const support = await this.prisma.support.create({
      data: supportData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return this.formatSupportResponse(support);
  }

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

    if (theme) {
      where.theme = theme;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const [supports, total] = await Promise.all([
      this.prisma.support.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.support.count({ where }),
    ]);

    console.log(`📊 ${supports.length} supports récupérés`);

    return {
      data: supports.map(support => this.formatSupportResponse(support)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<SupportResponseDto> {
    console.log(`🔍 Recherche du support avec ID: ${id}`);
    
    const support = await this.prisma.support.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    const formattedSupport = this.formatSupportResponse(support);
    console.log('📊 Support formaté pour findOne:', {
      id: formattedSupport.id,
      name: formattedSupport.name,
      images: formattedSupport.images,
      imagesCount: formattedSupport.images.length,
    });

    return formattedSupport;
  }

  async findBySku(sku: string): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findFirst({
      where: {
        sku: {
          equals: sku,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  
    if (!support) {
      throw new NotFoundException(`Support avec le SKU ${sku} non trouvé`);
    }
  
    return this.formatSupportResponse(support);
  }

  async update(id: string, updateSupportDto: UpdateSupportDto): Promise<SupportResponseDto> {
    const existingSupport = await this.prisma.support.findUnique({
      where: { id },
    });

    if (!existingSupport) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    if (updateSupportDto.sku && updateSupportDto.sku !== existingSupport.sku) {
      const skuExists = await this.prisma.support.findFirst({
        where: {
          sku: {
            equals: updateSupportDto.sku,
          },
          NOT: {
            id,
          },
        },
      });

      if (skuExists) {
        throw new BadRequestException('Un support avec ce SKU existe déjà');
      }
    }

    const sellingPrice = updateSupportDto.sellingPrice ?? existingSupport.sellingPrice;
    const purchasePrice = updateSupportDto.purchasePrice ?? existingSupport.purchasePrice;
    
    if (sellingPrice < purchasePrice) {
      throw new BadRequestException('Le prix de vente doit être supérieur au prix d\'achat');
    }

    const updateData: any = { ...updateSupportDto };
    
    if (updateSupportDto.compatibleThemes !== undefined) {
      updateData.compatibleThemes = this.ensureArray(updateSupportDto.compatibleThemes, []);
    }

    if (updateSupportDto.images !== undefined) {
      updateData.images = this.ensureArray(updateSupportDto.images, []);
    }

    console.log('🔄 Données de mise à jour:', {
      ...updateData,
      images: updateData.images,
      imagesCount: updateData.images?.length || 0,
    });

    const support = await this.prisma.support.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return this.formatSupportResponse(support);
  }

  async remove(id: string): Promise<void> {
    const existingSupport = await this.prisma.support.findUnique({
      where: { id },
    });

    if (!existingSupport) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    const salesCount = await this.prisma.saleItem.count({
      where: { supportId: id },
    });

    if (salesCount > 0) {
      throw new BadRequestException('Ce support ne peut pas être supprimé car il est utilisé dans des ventes');
    }

    if (existingSupport.images && existingSupport.images.length > 0) {
      const publicIds = this.cloudinary.extractPublicIdsFromUrls(existingSupport.images);
      if (publicIds.length > 0) {
        try {
          await this.cloudinary.deleteMultipleImages(publicIds);
        } catch (error) {
          console.error('Erreur lors de la suppression des images:', error);
        }
      }
    }

    await this.prisma.support.delete({
      where: { id },
    });
  }

  async uploadImage(id: string, file: Multer.File): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findUnique({
      where: { id },
    });

    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    try {
      const uploadResult = await this.cloudinary.uploadImage(file);
      
      const updatedSupport = await this.prisma.support.update({
        where: { id },
        data: {
          images: {
            push: uploadResult.secure_url,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return this.formatSupportResponse(updatedSupport);
    } catch (error) {
      console.error('Erreur lors de l\'upload de l\'image:', error);
      throw new BadRequestException('Erreur lors du téléchargement de l\'image');
    }
  }

  async removeImage(id: string, imageUrl: string): Promise<SupportResponseDto> {
    const support = await this.prisma.support.findUnique({
      where: { id },
    });

    if (!support) {
      throw new NotFoundException(`Support avec l'ID ${id} non trouvé`);
    }

    try {
      const publicId = this.cloudinary.extractPublicIdFromUrl(imageUrl);
      if (publicId) {
        await this.cloudinary.deleteImage(publicId);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'image:', error);
    }

    const updatedSupport = await this.prisma.support.update({
      where: { id },
      data: {
        images: {
          set: support.images.filter(img => img !== imageUrl),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return this.formatSupportResponse(updatedSupport);
  }

  async getStats() {
    const total = await this.prisma.support.count();
    const active = await this.prisma.support.count({ where: { status: 'actif' } });
    const totalStock = await this.prisma.support.aggregate({
      _sum: { stock: true },
    });
    const totalValue = await this.prisma.support.aggregate({
      _sum: {
        purchasePrice: true,
      },
    });

    return {
      total,
      active,
      totalStock: totalStock._sum.stock || 0,
      totalValue: totalValue._sum.purchasePrice || 0,
    };
  }

  async getLowStock() {
    const supports = await this.prisma.support.findMany({
      where: {
        stock: {
          lte: this.prisma.support.fields.minStock,
        },
        status: 'actif',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return supports.map(support => this.formatSupportResponse(support));
  }

  async getCategories() {
    const types = await this.prisma.support.groupBy({
      by: ['type'],
      _count: {
        _all: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    return types.map(type => ({
      name: type.type,
      count: type._count._all,
    }));
  }

  async filterByTheme(theme: string) {
    const supports = await this.prisma.support.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const filteredSupports = supports.filter(support => {
      const themes = (support.compatibleThemes as string[]) ?? [];
      return support.theme === theme || themes.includes(theme);
    });    

    return filteredSupports.map(support => this.formatSupportResponse(support));
  }

  private formatSupportResponse(support: any): SupportResponseDto {
    // S'assurer que les images sont toujours un tableau valide
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

    // S'assurer que compatibleThemes est toujours un tableau valide
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

    // Log pour le débogage
    console.log(`🖼️ Formatting support ${support.id} - Images:`, {
      rawImages: support.images,
      formattedImages: images,
      imagesCount: images.length,
    });

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
      compatibleThemes: compatibleThemes,
      capacity: support.capacity,
      weight: support.weight ?? 0,
      weightUnit: support.weightUnit ?? 'g',
      purchasePrice: support.purchasePrice,
      sellingPrice: support.sellingPrice,
      tva: support.tva ?? 18,
      stock: support.stock,
      minStock: support.minStock,
      maxStock: support.maxStock,
      images: images,
      status: support.status,
      createdAt: support.createdAt,
      updatedAt: support.updatedAt,
      userId: support.userId,
    };
  }

  // Méthode utilitaire pour s'assurer qu'une valeur est un tableau
  private ensureArray(value: any, defaultValue: any[] = []): any[] {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    if (Array.isArray(value)) {
      return value;
    }
    
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