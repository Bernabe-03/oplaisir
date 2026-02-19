import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------
  async create(createProductDto: CreateProductDto, userId: string, images: string[] = []) {
    // Vérifier l'unicité du SKU
    const existing = await this.prisma.product.findUnique({
      where: { sku: createProductDto.sku },
    });
    if (existing) {
      throw new BadRequestException('Un produit avec ce SKU existe déjà');
    }

    // Mapping des statuts texte → enum
    const statusMap: Record<string, ProductStatus> = {
      actif: ProductStatus.ACTIF,
      inactif: ProductStatus.INACTIF,
      epuise: ProductStatus.EPUISE,
      rupture: ProductStatus.EPUISE,
      nouveau: ProductStatus.ACTIF,
      promo: ProductStatus.ACTIF,
      expire: ProductStatus.EXPIRE,
    };

    let status = statusMap[(createProductDto.status ?? 'actif').toLowerCase()] || ProductStatus.ACTIF;

    // Statut automatique si la date d'expiration est dépassée
    if (createProductDto.expirationDate) {
      const expiry = new Date(createProductDto.expirationDate);
      if (expiry < new Date()) {
        status = ProductStatus.EXPIRE;
      }
    }

    const productData = {
      ...createProductDto,
      weight: createProductDto.weight ?? 0,
      weightUnit: createProductDto.weightUnit ?? 'g',
      shelfLifeMonths: createProductDto.shelfLifeMonths ?? 0,
      batchNumber: createProductDto.batchNumber ?? '',
      storageConditions: createProductDto.storageConditions ?? 'température ambiante',
      images,
      userId: userId || null,
      status,
    };

    const created = await this.prisma.product.create({ data: productData });
    return this.formatProductResponse(created);
  }

  // ------------------------------------------------------------
  // FIND ALL (avec pagination, recherche, filtre)
  // ------------------------------------------------------------
  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    category?: string,
    status?: ProductStatus,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { batchNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
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
      this.prisma.product.count({ where }),
    ]);

    // Récupérer les statistiques d'avis pour chaque produit
    const productsWithReviews = await Promise.all(
      products.map(async (product) => {
        const formatted = this.formatProductResponse(product);
        try {
          const reviewStats = await this.calculateProductReviewStats(product.id);
          return { ...formatted, reviewStats };
        } catch {
          return formatted;
        }
      }),
    );

    return {
      data: productsWithReviews,
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
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
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

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const formatted = this.formatProductResponse(product);
    try {
      const reviewStats = await this.calculateProductReviewStats(id);
      return { ...formatted, reviewStats };
    } catch {
      return formatted;
    }
  }

  // ------------------------------------------------------------
  // FIND ONE WITH REVIEWS (détaillé)
  // ------------------------------------------------------------
  async findOneWithReviews(id: string, query: any) {
    const product = await this.prisma.product.findUnique({
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

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const formatted = this.formatProductResponse(product);
    const reviews = await this.findProductReviews(id, query);
    const reviewStats = await this.calculateProductReviewStats(id);

    return {
      product: { ...formatted, reviewStats },
      reviews,
    };
  }

  // ------------------------------------------------------------
  // FIND BY SKU
  // ------------------------------------------------------------
  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
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

    if (!product) {
      throw new NotFoundException(`Produit avec le SKU ${sku} non trouvé`);
    }

    const formatted = this.formatProductResponse(product);
    try {
      const reviewStats = await this.calculateProductReviewStats(product.id);
      return { ...formatted, reviewStats };
    } catch {
      return formatted;
    }
  }

  // ------------------------------------------------------------
  // UPDATE – CORRIGÉ : mise à jour partielle stricte
  // ------------------------------------------------------------
  async update(id: string, updateProductDto: UpdateProductDto, userId: string, images: string[] = []) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    // Construction du payload de mise à jour – UNIQUEMENT les champs présents
    const updatePayload: any = {};

    // Champs scalaires
    const scalarFields = [
      'sku', 'name', 'description', 'category', 'subCategory', 'brand', 'supplier',
      'unit', 'barcode', 'batchNumber', 'storageConditions',
    ];
    scalarFields.forEach((field) => {
      if (updateProductDto[field] !== undefined) {
        updatePayload[field] = updateProductDto[field];
      }
    });

    // Champs numériques
    const numberFields = [
      'purchasePrice', 'sellingPrice', 'tva', 'weight',
      'stock', 'minStock', 'maxStock', 'shelfLifeMonths',
    ];
    numberFields.forEach((field) => {
      if (updateProductDto[field] !== undefined) {
        const val = updateProductDto[field];
        updatePayload[field] = val === null ? null : Number(val);
      }
    });

    // Champs de date
    const dateFields = ['expirationDate', 'manufacturingDate'];
    dateFields.forEach((field) => {
      if (updateProductDto[field] !== undefined) {
        const val = updateProductDto[field];
        updatePayload[field] = val ? new Date(val) : null;
      }
    });

    // Gestion automatique du statut "expiré" si une nouvelle date d'expiration est fournie
    if (updateProductDto.expirationDate) {
      const expiryDate = new Date(updateProductDto.expirationDate);
      if (expiryDate < new Date()) {
        updatePayload.status = ProductStatus.EXPIRE;
      }
    }

    // Images – UNIQUEMENT si fournies
    if (images.length > 0) {
      updatePayload.images = images;
    }

    // Mise à jour du userId (optionnel)
    if (userId) {
      updatePayload.userId = userId;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updatePayload,
    });

    return this.formatProductResponse(updated);
  }

  // ------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------
  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produit supprimé avec succès' };
  }

  // ------------------------------------------------------------
  // BULK DELETE
  // ------------------------------------------------------------
  async bulkDelete(ids: string[]) {
    await this.prisma.product.deleteMany({
      where: { id: { in: ids } },
    });
    return { message: `${ids.length} produit(s) supprimé(s) avec succès` };
  }

  // ------------------------------------------------------------
  // UPDATE STOCK (endpoint spécifique)
  // ------------------------------------------------------------
  async updateStock(id: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new BadRequestException('Stock insuffisant');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    return this.formatProductResponse(updated);
  }

  // ------------------------------------------------------------
  // GESTION DES EXPIRATIONS
  // ------------------------------------------------------------
  async getExpiredProducts() {
    const now = new Date();
    const products = await this.prisma.product.findMany({
      where: {
        expirationDate: { lt: now },
        status: { not: ProductStatus.EXPIRE },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const expired = await Promise.all(
      products.map(async (product) => {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { status: ProductStatus.EXPIRE },
        });
        return this.formatProductResponse({ ...product, status: ProductStatus.EXPIRE });
      }),
    );

    return expired;
  }

  async getProductsExpiringSoon(days: number = 30) {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);

    const products = await this.prisma.product.findMany({
      where: {
        expirationDate: { gte: now, lte: future },
        status: ProductStatus.ACTIF,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    return Promise.all(
      products.map(async (product) => {
        const formatted = this.formatProductResponse(product);
        if (formatted.expirationDate) {
          const diff = new Date(formatted.expirationDate).getTime() - now.getTime();
          const daysUntil = Math.ceil(diff / (1000 * 3600 * 24));
          return {
            ...formatted,
            daysUntilExpiry: daysUntil,
            isExpiringSoon: daysUntil <= 7,
          };
        }
        return formatted;
      }),
    );
  }

  async getExpiryStats() {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const [
      totalProducts,
      expiredProducts,
      expiringThisWeek,
      expiringThisMonth,
      expiredByCategory,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({
        where: {
          OR: [{ expirationDate: { lt: now } }, { status: ProductStatus.EXPIRE }],
        },
      }),
      this.prisma.product.count({
        where: {
          expirationDate: { gte: now, lte: nextWeek },
          status: ProductStatus.ACTIF,
        },
      }),
      this.prisma.product.count({
        where: {
          expirationDate: { gte: now, lte: nextMonth },
          status: ProductStatus.ACTIF,
        },
      }),
      this.prisma.product.groupBy({
        by: ['category'],
        where: {
          OR: [{ expirationDate: { lt: now } }, { status: ProductStatus.EXPIRE }],
        },
        _count: { _all: true },
      }),
    ]);

    return {
      totalProducts,
      expiredProducts,
      expiringThisWeek,
      expiringThisMonth,
      expiredByCategory: expiredByCategory.map((cat) => ({
        category: cat.category,
        count: cat._count._all,
      })),
      expiryRate: totalProducts > 0 ? (expiredProducts / totalProducts) * 100 : 0,
    };
  }

  async updateExpiryStatus(productIds: string[], status: ProductStatus) {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { status },
    });

    return {
      message: `${result.count} produit(s) mis à jour`,
      count: result.count,
    };
  }

  async validateProductExpiry(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${productId} non trouvé`);
    }

    const now = new Date();
    let isExpired = false;
    let status = product.status;

    if (product.expirationDate && product.expirationDate < now) {
      isExpired = true;
      status = ProductStatus.EXPIRE;
      if (product.status !== ProductStatus.EXPIRE) {
        await this.prisma.product.update({
          where: { id: productId },
          data: { status: ProductStatus.EXPIRE },
        });
      }
    }

    let daysUntilExpiry: number | undefined;
    if (product.expirationDate) {
      const diff = product.expirationDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diff / (1000 * 3600 * 24));
    }

    return {
      productId,
      isExpired,
      daysUntilExpiry,
      status,
      expirationDate: product.expirationDate,
      currentStock: product.stock,
      recommendation: isExpired
        ? 'Produit expiré - Ne pas vendre'
        : daysUntilExpiry && daysUntilExpiry <= 7
        ? 'Produit expirant bientôt - Privilégier la vente'
        : 'Produit valide',
    };
  }

  // ------------------------------------------------------------
  // LOW STOCK
  // ------------------------------------------------------------
  async getLowStock() {
    const products = await this.prisma.product.findMany({
      where: {
        stock: { lte: this.prisma.product.fields.minStock },
        status: ProductStatus.ACTIF,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return Promise.all(
      products.map(async (product) => {
        const formatted = this.formatProductResponse(product);
        try {
          const reviewStats = await this.calculateProductReviewStats(product.id);
          return { ...formatted, reviewStats };
        } catch {
          return formatted;
        }
      }),
    );
  }

  // ------------------------------------------------------------
  // CATEGORIES
  // ------------------------------------------------------------
  async getCategories() {
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });

    return categories.map((cat) => ({
      name: cat.category,
      count: cat._count._all,
    }));
  }

  // ------------------------------------------------------------
  // STATS GLOBALES
  // ------------------------------------------------------------
  async getStats() {
    const totalProducts = await this.prisma.product.count();
    const totalInStock = await this.prisma.product.count({
      where: { stock: { gt: 0 } },
    });

    const products = await this.prisma.product.findMany({
      select: { stock: true, purchasePrice: true },
    });

    const totalValue = products.reduce(
      (sum, p) => sum + p.stock * p.purchasePrice,
      0,
    );

    const lowStockCount = await this.prisma.product.count({
      where: {
        stock: { lte: this.prisma.product.fields.minStock },
        status: ProductStatus.ACTIF,
      },
    });

    return {
      total: totalProducts,
      inStock: totalInStock,
      lowStock: lowStockCount,
      totalValue,
    };
  }

  // ------------------------------------------------------------
  // UTILITAIRES PRIVÉES
  // ------------------------------------------------------------
  private async calculateProductReviewStats(productId: string) {
    try {
      const reviews = await this.prisma.review.findMany({
        where: { productId, status: 'APPROVED' },
        select: { rating: true, isVerifiedPurchase: true },
      });

      if (reviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          rating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          verifiedPurchases: 0,
        };
      }

      const total = reviews.length;
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      const average = parseFloat((sum / total).toFixed(1));

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach((r) => distribution[r.rating]++);
      const verified = reviews.filter((r) => r.isVerifiedPurchase).length;

      return {
        averageRating: average,
        totalReviews: total,
        rating: Math.round(average * 2) / 2,
        ratingDistribution: distribution,
        verifiedPurchases: verified,
      };
    } catch {
      return {
        averageRating: 0,
        totalReviews: 0,
        rating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedPurchases: 0,
      };
    }
  }

  private async findProductReviews(productId: string, query: any) {
    const { page = 1, limit = 10, rating, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    const where: any = { productId, status: 'APPROVED' };
    if (rating) where.rating = rating;

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'helpful') orderBy = { helpfulCount: 'desc' };
    else if (sortBy === 'highest_rating') orderBy = { rating: 'desc' };
    else if (sortBy === 'lowest_rating') orderBy = { rating: 'asc' };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private formatProductResponse(product: any): ProductResponseDto {
    const now = new Date();
    let isExpired = false;
    let isExpiringSoon = false;
    let daysUntilExpiry: number | undefined;

    if (product.expirationDate) {
      const expiry = new Date(product.expirationDate);
      const diff = expiry.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diff / (1000 * 3600 * 24));
      isExpired = expiry < now;
      isExpiringSoon = !isExpired && daysUntilExpiry <= 30;
    }

    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode || undefined,
      name: product.name,
      description: product.description || undefined,
      category: product.category,
      subCategory: product.subCategory || undefined,
      brand: product.brand || undefined,
      supplier: product.supplier || undefined,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      tva: product.tva,
      unit: product.unit,
      weight: product.weight ?? undefined,
      weightUnit: product.weightUnit ?? undefined,
      stock: product.stock,
      minStock: product.minStock,
      maxStock: product.maxStock,
      images: product.images || [],
      expirationDate: product.expirationDate || undefined,
      manufacturingDate: product.manufacturingDate || undefined,
      shelfLifeMonths: product.shelfLifeMonths || undefined,
      batchNumber: product.batchNumber || undefined,
      storageConditions: product.storageConditions || undefined,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      userId: product.userId || undefined,
      user: product.user
        ? {
            id: product.user.id,
            name: product.user.name,
            email: product.user.email,
          }
        : undefined,
      isExpired,
      isExpiringSoon,
      daysUntilExpiry,
    };
  }
}