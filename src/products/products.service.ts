import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async create(createProductDto: CreateProductDto, userId: string, images: string[] = []) {
    const productData = createProductDto;

    // Vérifier que le SKU est unique
    const existingProduct = await this.prisma.product.findUnique({
      where: { sku: productData.sku },
    });

    if (existingProduct) {
      throw new BadRequestException('Un produit avec ce SKU existe déjà');
    }

    const statusMap = {
      'actif': ProductStatus.ACTIF,
      'inactif': ProductStatus.INACTIF,
      'epuise': ProductStatus.EPUISE,
      'rupture': ProductStatus.EPUISE,
      'nouveau': ProductStatus.ACTIF,
      'promo': ProductStatus.ACTIF,
      'expire': ProductStatus.EXPIRE
    };
    
    // Gérer automatiquement le statut si le produit est expiré
    let status = statusMap[(productData.status ?? 'actif').toLowerCase()] || ProductStatus.ACTIF;
    if (productData.expirationDate) {
      const expiryDate = new Date(productData.expirationDate);
      const today = new Date();
      if (expiryDate < today) {
        status = ProductStatus.EXPIRE;
      }
    }
    
    const productDataWithDefaults = {
      ...productData,
      weight: productData.weight ?? 0,
      weightUnit: productData.weightUnit ?? 'g',
      shelfLifeMonths: productData.shelfLifeMonths ?? 0,
      batchNumber: productData.batchNumber ?? '',
      storageConditions: productData.storageConditions ?? 'température ambiante',
      images: images,
      userId: userId || null,
      status: status,
    };

    // Créer le produit
    const createdProduct = await this.prisma.product.create({
      data: productDataWithDefaults,
    });

    return this.formatProductResponse(createdProduct);
  }

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
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Récupérer les statistiques d'avis pour chaque produit
    const productsWithReviews = await Promise.all(
      products.map(async (product) => {
        const formattedProduct = this.formatProductResponse(product);
        
        try {
          const reviewStats = await this.calculateProductReviewStats(product.id);
          return {
            ...formattedProduct,
            reviewStats,
          };
        } catch (error) {
          // Si le service d'avis n'est pas disponible, retourner le produit sans statistiques
          return formattedProduct;
        }
      })
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

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const formattedProduct = this.formatProductResponse(product);
    
    // Récupérer les statistiques d'avis
    try {
      const reviewStats = await this.calculateProductReviewStats(id);
      return {
        ...formattedProduct,
        reviewStats,
      };
    } catch (error) {
      // Si le service d'avis n'est pas disponible, retourner le produit sans statistiques
      return formattedProduct;
    }
  }

  async findOneWithReviews(id: string, query: any) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const formattedProduct = this.formatProductResponse(product);
    
    // Récupérer les avis détaillés et statistiques
    const reviews = await this.findProductReviews(id, query);
    const reviewStats = await this.calculateProductReviewStats(id);
    
    return {
      product: {
        ...formattedProduct,
        reviewStats,
      },
      reviews,
    };
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec le SKU ${sku} non trouvé`);
    }

    const formattedProduct = this.formatProductResponse(product);
    
    // Récupérer les statistiques d'avis
    try {
      const reviewStats = await this.calculateProductReviewStats(product.id);
      return {
        ...formattedProduct,
        reviewStats,
      };
    } catch (error) {
      return formattedProduct;
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, userId: string, images: string[] = []) {
    // Vérifier que le produit existe
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const updateData = updateProductDto;

    // Gérer automatiquement le statut si le produit est expiré
    let status = existingProduct.status;
    if (updateData.expirationDate) {
      const expiryDate = new Date(updateData.expirationDate);
      const today = new Date();
      if (expiryDate < today) {
        status = ProductStatus.EXPIRE;
      }
    }

    // Préparer les données de mise à jour
    const updateDataWithDefaults = {
      ...updateData,
      images: images,
      userId: userId || existingProduct.userId,
      weight: updateData.weight ?? existingProduct.weight ?? 0,
      weightUnit: updateData.weightUnit ?? existingProduct.weightUnit ?? 'g',
      shelfLifeMonths: updateData.shelfLifeMonths ?? existingProduct.shelfLifeMonths ?? 0,
      batchNumber: updateData.batchNumber ?? existingProduct.batchNumber ?? '',
      storageConditions: updateData.storageConditions ?? existingProduct.storageConditions ?? 'température ambiante',
      status: updateData.status ?? status,
    };

    // Mettre à jour le produit
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateDataWithDefaults,
    });

    const formattedProduct = this.formatProductResponse(updatedProduct);
    
    // Récupérer les statistiques d'avis mises à jour
    try {
      const reviewStats = await this.calculateProductReviewStats(id);
      return {
        ...formattedProduct,
        reviewStats,
      };
    } catch (error) {
      return formattedProduct;
    }
  }

  async remove(id: string) {
    // Vérifier que le produit existe
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    // Supprimer le produit
    await this.prisma.product.delete({
      where: { id },
    });

    return { message: 'Produit supprimé avec succès' };
  }

  async bulkDelete(ids: string[]) {
    // Supprimer les produits
    await this.prisma.product.deleteMany({
      where: { id: { in: ids } },
    });

    return { message: `${ids.length} produit(s) supprimé(s) avec succès` };
  }

  async updateStock(id: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new BadRequestException('Stock insuffisant');
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    const formattedProduct = this.formatProductResponse(updatedProduct);
    
    // Récupérer les statistiques d'avis
    try {
      const reviewStats = await this.calculateProductReviewStats(id);
      return {
        ...formattedProduct,
        reviewStats,
      };
    } catch (error) {
      return formattedProduct;
    }
  }

  // Nouvelle méthode pour récupérer les produits expirés
  async getExpiredProducts() {
    const now = new Date();
    
    const products = await this.prisma.product.findMany({
      where: {
        expirationDate: {
          lt: now,
        },
        status: {
          not: ProductStatus.EXPIRE,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    // Mettre à jour le statut des produits expirés
    const expiredProducts = await Promise.all(
      products.map(async (product) => {
        // Mettre à jour le statut en expiré
        await this.prisma.product.update({
          where: { id: product.id },
          data: { status: ProductStatus.EXPIRE },
        });

        return this.formatProductResponse({
          ...product,
          status: ProductStatus.EXPIRE,
        });
      })
    );

    return expiredProducts;
  }

  // Nouvelle méthode pour récupérer les produits expirant bientôt
  async getProductsExpiringSoon(days: number = 30) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    const products = await this.prisma.product.findMany({
      where: {
        expirationDate: {
          gte: now,
          lte: futureDate,
        },
        status: ProductStatus.ACTIF,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
      orderBy: {
        expirationDate: 'asc',
      },
    });

    return Promise.all(
      products.map(async (product) => {
        const formattedProduct = this.formatProductResponse(product);
        
        // Calculer les jours avant expiration
        if (formattedProduct.expirationDate) {
          const expiryDate = new Date(formattedProduct.expirationDate);
          const timeDiff = expiryDate.getTime() - now.getTime();
          const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          return {
            ...formattedProduct,
            daysUntilExpiry,
            isExpiringSoon: daysUntilExpiry <= 7,
          };
        }
        
        return formattedProduct;
      })
    );
  }

  // Nouvelle méthode pour les statistiques d'expiration
  async getExpiryStats() {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 30);

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
          OR: [
            { expirationDate: { lt: now } },
            { status: ProductStatus.EXPIRE },
          ],
        },
      }),
      this.prisma.product.count({
        where: {
          expirationDate: {
            gte: now,
            lte: nextWeek,
          },
          status: ProductStatus.ACTIF,
        },
      }),
      this.prisma.product.count({
        where: {
          expirationDate: {
            gte: now,
            lte: nextMonth,
          },
          status: ProductStatus.ACTIF,
        },
      }),
      this.prisma.product.groupBy({
        by: ['category'],
        where: {
          OR: [
            { expirationDate: { lt: now } },
            { status: ProductStatus.EXPIRE },
          ],
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    return {
      totalProducts,
      expiredProducts,
      expiringThisWeek,
      expiringThisMonth,
      expiredByCategory: expiredByCategory.map(cat => ({
        category: cat.category,
        count: cat._count._all,
      })),
      expiryRate: totalProducts > 0 ? (expiredProducts / totalProducts) * 100 : 0,
    };
  }

  // Nouvelle méthode pour mettre à jour le statut d'expiration
  async updateExpiryStatus(productIds: string[], status: ProductStatus) {
    const updatedProducts = await this.prisma.product.updateMany({
      where: {
        id: {
          in: productIds,
        },
      },
      data: {
        status,
      },
    });

    return {
      message: `${updatedProducts.count} produit(s) mis à jour`,
      count: updatedProducts.count,
    };
  }

  // Nouvelle méthode pour valider l'expiration d'un produit
  async validateProductExpiry(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${productId} non trouvé`);
    }

    const now = new Date();
    let isExpired = false;
    let status = product.status;

    // Vérifier si le produit est expiré
    if (product.expirationDate && product.expirationDate < now) {
      isExpired = true;
      status = ProductStatus.EXPIRE;
      
      // Mettre à jour le statut si nécessaire
      if (product.status !== ProductStatus.EXPIRE) {
        await this.prisma.product.update({
          where: { id: productId },
          data: { status: ProductStatus.EXPIRE },
        });
      }
    }

    // Calculer les jours avant expiration
    let daysUntilExpiry: number | undefined = undefined;
    if (product.expirationDate) {
      const expiryDate = new Date(product.expirationDate);
      const timeDiff = expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    return {
      productId,
      isExpired,
      daysUntilExpiry,
      status,
      expirationDate: product.expirationDate,
      currentStock: product.stock,
      recommendation: isExpired ? 'Produit expiré - Ne pas vendre' : 
                     (daysUntilExpiry && daysUntilExpiry <= 7 ? 'Produit expirant bientôt - Privilégier la vente' : 'Produit valide'),
    };
  }

  async getLowStock() {
    const products = await this.prisma.product.findMany({
      where: {
        stock: {
          lte: this.prisma.product.fields.minStock,
        },
        status: ProductStatus.ACTIF,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    // Récupérer les statistiques d'avis pour chaque produit
    const productsWithReviews = await Promise.all(
      products.map(async (product) => {
        const formattedProduct = this.formatProductResponse(product);
        
        try {
          const reviewStats = await this.calculateProductReviewStats(product.id);
          return {
            ...formattedProduct,
            reviewStats,
          };
        } catch (error) {
          return formattedProduct;
        }
      })
    );

    return productsWithReviews;
  }

  async getCategories() {
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
      _count: {
        _all: true,
      },
      orderBy: {
        category: 'asc',
      },
    });

    return categories.map(cat => ({
      name: cat.category,
      count: cat._count._all,
    }));
  }

  async getStats() {
    const totalProducts = await this.prisma.product.count();
    const totalInStock = await this.prisma.product.count({
      where: { stock: { gt: 0 } },
    });
    
    // Calculer la valeur totale du stock
    const products = await this.prisma.product.findMany({
      select: {
        stock: true,
        purchasePrice: true,
      },
    });

    const totalValue = products.reduce((sum, product) => {
      return sum + (product.stock * product.purchasePrice);
    }, 0);

    const lowStockCount = await this.prisma.product.count({
      where: {
        stock: {
          lte: this.prisma.product.fields.minStock,
        },
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

  private async calculateProductReviewStats(productId: string) {
    try {
      const reviews = await this.prisma.review.findMany({
        where: {
          productId,
          status: 'APPROVED',
        },
        select: {
          rating: true,
          isVerifiedPurchase: true,
        },
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
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      const averageRating = parseFloat((sum / total).toFixed(1));

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach(review => {
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });

      const verifiedPurchases = reviews.filter(r => r.isVerifiedPurchase).length;

      return {
        averageRating,
        totalReviews: total,
        rating: Math.round(averageRating * 2) / 2,
        ratingDistribution,
        verifiedPurchases,
      };
    } catch (error) {
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

    const where: any = {
      productId,
      status: 'APPROVED',
    };

    if (rating) {
      where.rating = rating;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'helpful') {
      orderBy = { helpfulCount: 'desc' };
    } else if (sortBy === 'highest_rating') {
      orderBy = { rating: 'desc' };
    } else if (sortBy === 'lowest_rating') {
      orderBy = { rating: 'asc' };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
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
    let daysUntilExpiry: number | undefined = undefined;

    // Calculer les propriétés d'expiration
    if (product.expirationDate) {
      const expiryDate = new Date(product.expirationDate);
      const timeDiff = expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      isExpired = expiryDate < now;
      if (daysUntilExpiry !== undefined) {
        isExpiringSoon = !isExpired && daysUntilExpiry <= 30;
      }
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
      
      // Nouveaux champs
      expirationDate: product.expirationDate || undefined,
      manufacturingDate: product.manufacturingDate || undefined,
      shelfLifeMonths: product.shelfLifeMonths || undefined,
      batchNumber: product.batchNumber || undefined,
      storageConditions: product.storageConditions || undefined,
      
      // Champs système
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      
      // Créateur
      userId: product.userId || undefined,
      user: product.user ? {
        id: product.user.id,
        name: product.user.name,
        email: product.user.email,
      } : undefined,
      
      // Propriétés calculées
      isExpired,
      isExpiringSoon,
      daysUntilExpiry,
    };
  }
}