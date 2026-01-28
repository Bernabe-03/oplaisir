import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateCoffretDto } from './dto/create-coffret.dto';
import { UpdateCoffretDto } from './dto/update-coffret.dto';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { CoffretProductDto } from './dto/create-coffret.dto';

@Injectable()
export class CoffretsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(createCoffretDto: CreateCoffretDto, userId?: string) {
    try {
      // Vérifier si un coffret avec le même nom existe
      const existingCoffret = await this.prisma.coffret.findFirst({
        where: { name: createCoffretDto.name },
      });

      if (existingCoffret) {
        throw new ConflictException('Un coffret avec ce nom existe déjà.');
      }

      // Calculer le coût total si les produits sont fournis
      let totalCost = createCoffretDto.cost || 0;
      let margin = createCoffretDto.margin || 30;
      
      if (createCoffretDto.products && createCoffretDto.products.length > 0) {
        // Récupérer les prix d'achat des produits
        const productIds = createCoffretDto.products.map(p => p.productId);
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, purchasePrice: true },
        });

        totalCost = createCoffretDto.products.reduce((sum, item) => {
          const product = products.find(p => p.id === item.productId);
          return sum + (product?.purchasePrice || 0) * item.quantity;
        }, 0);

        // Ajouter le coût du support si spécifié
        if (createCoffretDto.supportId) {
          const support = await this.prisma.support.findUnique({
            where: { id: createCoffretDto.supportId },
            select: { purchasePrice: true },
          });
          if (support) {
            totalCost += support.purchasePrice;
          }
        }

        // Calculer la marge si le prix est fourni mais pas la marge
        if (createCoffretDto.price && createCoffretDto.price > 0 && !createCoffretDto.margin) {
          margin = ((createCoffretDto.price - totalCost) / totalCost) * 100;
        }
      }

      const coffretData: any = {
        name: createCoffretDto.name,
        description: createCoffretDto.description,
        price: createCoffretDto.price,
        type: createCoffretDto.type || 'moyen',
        theme: createCoffretDto.theme || 'anniversaire',
        supportId: createCoffretDto.supportId,
        stock: createCoffretDto.stock || 0,
        minStock: createCoffretDto.minStock || 5,
        maxStock: createCoffretDto.maxStock || 50,
        status: createCoffretDto.status || 'ACTIF',
        sku: createCoffretDto.sku || `COF-${Date.now().toString().slice(-8)}`,
        cost: totalCost,
        margin: margin,
        rules: createCoffretDto.rules || {},
        ...(userId && { userId }),
      };

      const coffret = await this.prisma.coffret.create({
        data: {
          ...coffretData,
          ...(createCoffretDto.products && createCoffretDto.products.length > 0 && {
            items: {
              create: createCoffretDto.products.map(product => ({
                productId: product.productId,
                quantity: product.quantity,
                canReplace: product.canReplace !== false,
                ...(product.position && { position: product.position }),
                ...(product.notes && { notes: product.notes }),
              })),
            },
          }),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          support: true,
        },
      });

      return coffret;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Error creating coffret:', error);
      throw new BadRequestException('Erreur lors de la création du coffret');
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const { skip, take, where, orderBy } = params;
    
    const [coffrets, total] = await Promise.all([
      this.prisma.coffret.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          support: true,
        },
      }),
      this.prisma.coffret.count({ where }),
    ]);

    return {
      data: coffrets,
      total,
      page: skip && take ? Math.floor(skip / take) + 1 : 1,
      limit: take,
      totalPages: take ? Math.ceil(total / take) : 1,
    };
  }

  async findOne(id: string) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    return coffret;
  }

  async update(id: string, updateCoffretDto: UpdateCoffretDto) {
    try {
      // Vérifier si le coffret existe
      const existingCoffret = await this.prisma.coffret.findUnique({
        where: { id },
      });

      if (!existingCoffret) {
        throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
      }

      // Vérifier si le nom est déjà utilisé par un autre coffret
      if (updateCoffretDto.name && updateCoffretDto.name !== existingCoffret.name) {
        const nameExists = await this.prisma.coffret.findFirst({
          where: {
            name: updateCoffretDto.name,
            id: { not: id },
          },
        });

        if (nameExists) {
          throw new ConflictException('Un coffret avec ce nom existe déjà.');
        }
      }

      // Calculer le nouveau coût si les produits ou le support changent
      let totalCost = existingCoffret.cost || 0;
      if (updateCoffretDto.products || updateCoffretDto.supportId) {
        totalCost = 0;
        
        // Coût des produits
        if (updateCoffretDto.products && updateCoffretDto.products.length > 0) {
          const productIds = updateCoffretDto.products.map(p => p.productId);
          const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, purchasePrice: true },
          });

          totalCost = updateCoffretDto.products.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            return sum + (product?.purchasePrice || 0) * item.quantity;
          }, 0);
        }

        // Coût du support
        const supportId = updateCoffretDto.supportId || existingCoffret.supportId;
        if (supportId) {
          const support = await this.prisma.support.findUnique({
            where: { id: supportId },
            select: { purchasePrice: true },
          });
          if (support) {
            totalCost += support.purchasePrice;
          }
        }
      }

      const updateData: any = {
        ...updateCoffretDto,
        cost: totalCost,
      };

      // Si des produits sont fournis, mettre à jour la relation
      if (updateCoffretDto.products !== undefined) {
        // Supprimer les anciens items
        await this.prisma.coffretItem.deleteMany({
          where: { coffretId: id },
        });

        // Ajouter les nouveaux items
        updateData.items = {
          create: updateCoffretDto.products?.map(product => ({
            productId: product.productId,
            quantity: product.quantity,
            canReplace: product.canReplace !== false,
            ...(product.position && { position: product.position }),
            ...(product.notes && { notes: product.notes }),
          })) || [],
        };
      }

      const updatedCoffret = await this.prisma.coffret.update({
        where: { id },
        data: updateData,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          support: true,
        },
      });

      return updatedCoffret;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      console.error('Error updating coffret:', error);
      throw new BadRequestException('Erreur lors de la mise à jour du coffret');
    }
  }

  async remove(id: string) {
    // Vérifier si le coffret existe
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    // Vérifier si le coffret est utilisé dans des ventes
    const saleItems = await this.prisma.saleItem.count({
      where: { coffretId: id },
    });

    if (saleItems > 0) {
      throw new BadRequestException(
        'Impossible de supprimer ce coffret car il est associé à des ventes.'
      );
    }

    await this.prisma.coffret.delete({
      where: { id },
    });

    return { message: 'Coffret supprimé avec succès' };
  }

  async updateStock(id: string, quantity: number) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    return this.prisma.coffret.update({
      where: { id },
      data: { stock: quantity },
    });
  }

  async reserveStock(id: string, quantity: number) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    if (coffret.stock < quantity) {
      throw new BadRequestException('Stock insuffisant');
    }

    return this.prisma.coffret.update({
      where: { id },
      data: { stock: coffret.stock - quantity },
    });
  }

  async releaseStock(id: string, quantity: number) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    return this.prisma.coffret.update({
      where: { id },
      data: { stock: coffret.stock + quantity },
    });
  }

  async search(query: string) {
    const coffrets = await this.prisma.coffret.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { theme: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
      take: 50,
    });

    return coffrets;
  }

  async findByTheme(theme: string) {
    return this.prisma.coffret.findMany({
      where: { theme },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
    });
  }

  async findByType(type: string) {
    return this.prisma.coffret.findMany({
      where: { type },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
    });
  }

  async findLowStock(threshold: number = 10) {
    return this.prisma.coffret.findMany({
      where: {
        stock: {
          lte: threshold,
        },
        status: 'ACTIF',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
    });
  }

  async getStats() {
    const [
      totalCoffrets,
      activeCoffrets,
      lowStockCount,
      totalStockValue,
      byTheme,
      byType,
    ] = await Promise.all([
      this.prisma.coffret.count(),
      this.prisma.coffret.count({ where: { status: 'ACTIF' } }),
      this.prisma.coffret.count({ where: { stock: { lte: 10 } } }),
      this.prisma.coffret.aggregate({
        _sum: {
          stock: true,
        },
      }),
      this.prisma.coffret.groupBy({
        by: ['theme'],
        _count: {
          _all: true,
        },
        _sum: {
          stock: true,
        },
      }),
      this.prisma.coffret.groupBy({
        by: ['type'],
        _count: {
          _all: true,
        },
        _sum: {
          stock: true,
        },
      }),
    ]);

    return {
      totalCoffrets,
      activeCoffrets,
      lowStockCount,
      totalStock: totalStockValue._sum.stock || 0,
      byTheme,
      byType,
    };
  }

  async getBestSellers(limit: number = 10, period?: string) {
    const where = period ? this.getDateRange(period) : {};

    const bestSellers = await this.prisma.saleItem.groupBy({
      by: ['coffretId'],
      where: {
        ...where,
        coffretId: { not: null },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    // Récupérer les détails des coffrets
    const coffretIds = bestSellers.map(item => item.coffretId).filter(id => id !== null) as string[];
    const coffrets = await this.prisma.coffret.findMany({
      where: { id: { in: coffretIds } },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Combiner les données
    return bestSellers.map(item => ({
      coffret: coffrets.find(c => c.id === item.coffretId),
      totalSold: item._sum.quantity,
    })).filter(item => item.coffret);
  }

  async uploadImage(id: string, imageFile: Express.Multer.File) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    // Upload vers Cloudinary
    const uploadResult = await this.cloudinary.uploadImage(imageFile);

    // Mettre à jour les images du coffret
    const updatedImages = [...coffret.images, uploadResult.secure_url];

    return this.prisma.coffret.update({
      where: { id },
      data: { images: updatedImages },
    });
  }

  async deleteImage(id: string, imageUrl: string) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    // Extraire le public_id de l'URL Cloudinary
    const urlParts = imageUrl.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];

    // Supprimer l'image de Cloudinary
    await this.cloudinary.deleteImage(publicId);

    // Supprimer l'URL du tableau d'images
    const updatedImages = coffret.images.filter(img => img !== imageUrl);

    return this.prisma.coffret.update({
      where: { id },
      data: { images: updatedImages },
    });
  }

  async bulkUpdate(ids: string[], updateData: UpdateCoffretDto) {
    const coffrets = await this.prisma.coffret.findMany({
      where: { id: { in: ids } },
    });

    if (coffrets.length !== ids.length) {
      throw new BadRequestException('Un ou plusieurs coffrets non trouvés');
    }

    const results = await Promise.all(
      ids.map(id => this.update(id, updateData))
    );

    return results;
  }

  async bulkDelete(ids: string[]) {
    const coffrets = await this.prisma.coffret.findMany({
      where: { id: { in: ids } },
    });

    if (coffrets.length !== ids.length) {
      throw new BadRequestException('Un ou plusieurs coffrets non trouvés');
    }

    // Vérifier si des coffrets sont utilisés dans des ventes
    const usedCoffrets = await this.prisma.saleItem.findMany({
      where: { coffretId: { in: ids } },
      distinct: ['coffretId'],
    });

    if (usedCoffrets.length > 0) {
      throw new BadRequestException(
        `Impossible de supprimer ${usedCoffrets.length} coffret(s) car ils sont associés à des ventes.`
      );
    }

    await this.prisma.coffret.deleteMany({
      where: { id: { in: ids } },
    });

    return { message: `${ids.length} coffret(s) supprimé(s) avec succès` };
  }

  async duplicate(id: string, newName?: string) {
    const original = await this.prisma.coffret.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!original) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    const name = newName || `${original.name} (Copie)`;

    // Créer le nouveau coffret
    const { id: _, createdAt, updatedAt, ...coffretData } = original;

    const createDto: CreateCoffretDto = {
      name,
      description: coffretData.description || undefined,
      price: coffretData.price,
      type: coffretData.type,
      theme: coffretData.theme,
      supportId: coffretData.supportId || undefined,
      products: coffretData.items?.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        canReplace: item.canReplace,
      })) || [],
      stock: coffretData.stock,
      minStock: coffretData.minStock || 5,
      maxStock: coffretData.maxStock || 50,
      status: coffretData.status,
      sku: `COF-${Date.now().toString().slice(-8)}`,
    };

    return this.create(createDto);
  }

  async validateStockAvailability(id: string, requiredQuantity: number) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    const unavailable: Array<{
      type: string;
      id: string;
      name: string;
      required: number;
      available: number;
    }> = [];

    // Vérifier le stock du coffret
    if (coffret.stock < requiredQuantity) {
      unavailable.push({
        type: 'coffret',
        id: coffret.id,
        name: coffret.name,
        required: requiredQuantity,
        available: coffret.stock,
      });
    }

    // Vérifier le stock de chaque produit
    for (const item of coffret.items) {
      if (item.product.stock < item.quantity * requiredQuantity) {
        unavailable.push({
          type: 'product',
          id: item.product.id,
          name: item.product.name,
          required: item.quantity * requiredQuantity,
          available: item.product.stock,
        });
      }
    }

    return {
      available: unavailable.length === 0,
      unavailable,
    };
  }

  async getMarginAnalysis(id: string) {
    const coffret = await this.prisma.coffret.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        support: true,
      },
    });

    if (!coffret) {
      throw new NotFoundException(`Coffret avec l'ID ${id} non trouvé`);
    }

    const cost = coffret.cost || 0;
    const sellingPrice = coffret.price;
    const margin = sellingPrice - cost;
    const marginPercentage = cost > 0 ? (margin / cost) * 100 : 0;

    return {
      cost,
      sellingPrice,
      margin,
      marginPercentage,
      supportCost: coffret.support?.purchasePrice || 0,
      productsCost: cost - (coffret.support?.purchasePrice || 0),
    };
  }

  private getDateRange(period: string) {
    const now = new Date();
    let from: Date;

    switch (period) {
      case 'day':
        from = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        from = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        from = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        from = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        from = new Date(0); // Toutes les dates
    }

    return {
      sale: {
        date: {
          gte: from,
        },
      },
    };
  }
}