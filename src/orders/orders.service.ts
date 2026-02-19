import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ValidateOrderDto } from './dto/validate-order.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsGateway } from '../notifications/notifications.gateway';

// Types pour les enums
type OrderStatus = 'PENDING' | 'VALIDATED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED' | 'DELIVERED';
type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'FAILED' | 'REFUNDED';

// Type pour les items normalisés
interface NormalizedOrderItem {
  type: 'product' | 'coffret' | 'support';
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
  description?: string;
  images?: string[];
  metadata?: any;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const todayOrdersCount = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999))
        }
      }
    });
    
    const sequence = (todayOrdersCount + 1).toString().padStart(4, '0');
    return `CMD-${year}${month}${day}-${sequence}`;
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string) {
    // D'abord, normaliser les items pour corriger les types incorrects
    const normalizedItems = await this.normalizeOrderItems(createOrderDto.items);
    
    // Remplacer les items dans le DTO
    createOrderDto.items = normalizedItems;
    
    // Vérifier le stock pour chaque produit, support et coffret
    for (const item of createOrderDto.items) {
      if (item.type === 'product') {
        const product = await this.prisma.product.findUnique({
          where: { id: item.id }
        });
        
        if (!product) {
          throw new BadRequestException(`Produit ${item.name} non trouvé`);
        }
        
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${product.name}. Disponible: ${product.stock}, Demandé: ${item.quantity}`
          );
        }
      }
      
      // VÉRIFICATION POUR LES SUPPORTS
      if (item.type === 'support') {
        console.log(`🔍 Recherche du support:`, {
          id: item.id,
          sku: item.sku,
          name: item.name,
          type: item.type
        });
        
        let support: any = null;
        
        // Chercher par ID
        if (item.id) {
          support = await this.prisma.support.findUnique({
            where: { id: item.id }
          });
        }
        
        // Si pas trouvé, chercher par SKU
        if (!support && item.sku) {
          support = await this.prisma.support.findUnique({
            where: { sku: item.sku }
          });
        }
        
        // Si toujours pas trouvé, chercher par nom (approximatif)
        if (!support && item.name) {
          const supports = await this.prisma.support.findMany({
            where: {
              OR: [
                { name: { contains: item.name, mode: 'insensitive' } },
                { name: { contains: item.name.replace('support', '').trim(), mode: 'insensitive' } }
              ]
            }
          });
          
          if (supports.length > 0) {
            support = supports[0];
            console.log(`✅ Support trouvé par nom similaire: ${support.name} (ID: ${support.id})`);
          }
        }
        
        // Si le support n'existe pas, créer un enregistrement temporaire
        if (!support) {
          console.warn(`⚠️ Support "${item.name}" non trouvé, création d'un enregistrement temporaire`);
          
          // Vérifier si le SKU commence par SUP- pour confirmer que c'est un support
          if (item.sku && item.sku.startsWith('SUP-')) {
            support = await this.prisma.support.create({
              data: {
                name: item.name,
                sku: item.sku || `SUP-TEMP-${Date.now()}`,
                description: item.description || 'Support temporaire créé automatiquement',
                type: (item.metadata?.type as string) || 'boite',
                material: (item.metadata?.material as string) || 'carton',
                sellingPrice: item.unitPrice,
                stock: 999,
                status: 'actif',
                capacity: item.metadata?.capacity ? parseInt(item.metadata.capacity) : 1,
                theme: (item.metadata?.theme as string) || 'standard',
                compatibleThemes: Array.isArray(item.metadata?.compatibleThemes) 
                  ? item.metadata.compatibleThemes 
                  : ['standard']
              }
            });
            
            console.log(`✅ Support temporaire créé: ${support.name} (ID: ${support.id})`);
          } else {
            throw new BadRequestException(
              `Support "${item.name}" (ID: ${item.id}, SKU: ${item.sku}) non trouvé dans la base de données`
            );
          }
        }
        
        // Mettre à jour l'ID avec celui de la base de données
        item.id = support.id;
        
        // Vérifier le stock (sauf pour les supports temporaires avec stock 999)
        if (support && support.stock < item.quantity && support.stock !== 999) {
          throw new BadRequestException(
            `Stock insuffisant pour le support ${support.name}. Disponible: ${support.stock}, Demandé: ${item.quantity}`
          );
        }
      }
      
      // Vérification pour les coffrets
      if (item.type === 'coffret') {
        const coffret = await this.prisma.coffret.findUnique({
          where: { id: item.id }
        });
        
        if (!coffret) {
          throw new BadRequestException(`Coffret ${item.name} non trouvé`);
        }
        
        if (coffret.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${coffret.name}. Disponible: ${coffret.stock}, Demandé: ${item.quantity}`
          );
        }
      }
    }
  
    const orderNumber = await this.generateOrderNumber();
    
    // Calcul des totaux
    const subtotal = createOrderDto.subtotal || createOrderDto.items.reduce(
      (sum, item) => sum + item.totalPrice, 
      0
    );
    
    const discountAmount = createOrderDto.discount?.amount || 0;
    const total = createOrderDto.total || (subtotal - discountAmount + createOrderDto.deliveryCost);
  
    // CRÉATION DE LA COMMANDE AVEC LES ITEMS
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        customerEmail: createOrderDto.customerEmail,
        customerAddress: createOrderDto.customerAddress,
        customerCommune: createOrderDto.customerCommune,
        deliveryNotes: createOrderDto.deliveryNotes,
        
        subtotal,
        discountAmount,
        discountType: createOrderDto.discount?.type || 'fixed',
        discountCode: createOrderDto.discount?.code,
        discountLabel: createOrderDto.discount?.label,
        deliveryCost: createOrderDto.deliveryCost,
        total,
        
        paymentMethod: createOrderDto.paymentMethod,
        requiresValidation: createOrderDto.requiresValidation ?? true,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        
        userId,
        
        items: {
          create: createOrderDto.items.map(item => {
            const itemData: any = {
              type: item.type,
              name: item.name,
              sku: item.sku,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              images: item.images || [],
              metadata: item.metadata || {}
            };
            
            if (item.type === 'product') {
              itemData.productId = item.id;
            } else if (item.type === 'coffret') {
              itemData.coffretId = item.id;
            } else if (item.type === 'support') {
              itemData.supportId = item.id;
            }
            
            return itemData;
          })
        },
        
        history: {
          create: {
            status: 'PENDING',
            action: 'created',
            description: 'Commande créée par le client',
            userId,
            metadata: {}
          }
        }
      },
      include: {
        items: true,
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // ÉMISSION DE L'ÉVÉNEMENT DE NOUVELLE COMMANDE
    this.eventEmitter.emit('order.created', order);

    // ENVOYER LA NOTIFICATION IMMÉDIATEMENT VIA WEBSOCKET
    await this.notificationsGateway.notifyNewOrder(order);

    console.log(`📢 Notification envoyée pour la nouvelle commande: ${order.orderNumber}`);
  
    return order;
  }

  /**
   * Normalise les items de commande pour corriger les types incorrects
   * Par exemple, les supports envoyés comme produits doivent être corrigés en type 'support'
   */
  async normalizeOrderItems(items: any[]): Promise<NormalizedOrderItem[]> {
    const normalizedItems: NormalizedOrderItem[] = [];
    
    for (const item of items) {
      const normalizedItem: NormalizedOrderItem = { ...item };
      
      // CORRECTION 1: Si le SKU commence par SUP- ou SUPP-, c'est un support
      if (item.sku && (item.sku.startsWith('SUP-') || item.sku.startsWith('SUPP-'))) {
        console.log(`🔄 Correction automatique: ${item.name} (SKU: ${item.sku}) est un support`);
        normalizedItem.type = 'support';
        
        // Vérifier si le support existe dans la base
        if (item.id) {
          const existingSupport = await this.prisma.support.findUnique({
            where: { id: item.id }
          });
          
          if (!existingSupport && item.sku) {
            // Chercher par SKU
            const supportBySku = await this.prisma.support.findUnique({
              where: { sku: item.sku }
            });
            
            if (supportBySku) {
              normalizedItem.id = supportBySku.id;
            }
          }
        }
      }
      
      // CORRECTION 2: Si le SKU commence par COF-, c'est un coffret
      if (item.sku && item.sku.startsWith('COF-')) {
        console.log(`🔄 Correction automatique: ${item.name} (SKU: ${item.sku}) est un coffret`);
        normalizedItem.type = 'coffret';
      }
      
      // CORRECTION 3: Si le nom contient "support", c'est probablement un support
      if (item.name && item.name.toLowerCase().includes('support') && item.type === 'product') {
        console.log(`🔄 Correction par nom: ${item.name} contient "support"`);
        normalizedItem.type = 'support';
      }
      
      // CORRECTION 4: Si l'item a des métadonnées typiques d'un support
      if (item.metadata && (item.metadata.type === 'boite' || item.metadata.type === 'support')) {
        console.log(`🔄 Correction par métadonnées: ${item.name} a des métadonnées de support`);
        normalizedItem.type = 'support';
      }
      
      normalizedItems.push(normalizedItem);
    }
    
    console.log('📋 Items normalisés:', {
      total: normalizedItems.length,
      byType: normalizedItems.reduce((acc: Record<string, number>, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {})
    });
    
    return normalizedItems;
  }

  async getOrders(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const where = status ? { 
      status: status as OrderStatus 
    } : {};
    
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          history: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            coffret: true,
            support: true
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
            coffret: true,
            support: true
          }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    return order;
  }

  async validateOrder(id: string, validateOrderDto: ValidateOrderDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    let newStatus: OrderStatus;
    let description: string;
    let action: string;

    switch (validateOrderDto.action) {
      case 'validate':
        newStatus = 'VALIDATED';
        action = 'validated';
        description = 'Commande validée par l\'administrateur';
        
        // Mettre à jour le stock pour les produits et supports
        for (const item of order.items) {
          if (item.type === 'product' && item.productId) {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });
          } else if (item.type === 'support' && item.supportId) {
            // Ne pas décrémenter le stock pour les supports temporaires (stock = 999)
            const support = await this.prisma.support.findUnique({
              where: { id: item.supportId }
            });
            
            if (support && support.stock !== 999) {
              await this.prisma.support.update({
                where: { id: item.supportId },
                data: {
                  stock: {
                    decrement: item.quantity
                  }
                }
              });
            }
          } else if (item.type === 'coffret' && item.coffretId) {
            await this.prisma.coffret.update({
              where: { id: item.coffretId },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });
          }
        }
        break;
        
      case 'reject':
        newStatus = 'REJECTED';
        action = 'rejected';
        description = `Commande rejetée: ${validateOrderDto.reason}`;
        break;
        
      case 'complete':
        newStatus = 'COMPLETED';
        action = 'completed';
        description = 'Commande marquée comme complétée';
        break;
        
      case 'cancel':
        newStatus = 'CANCELLED';
        action = 'cancelled';
        description = 'Commande annulée';
        
        // Restaurer le stock si la commande était validée
        if (order.status === 'VALIDATED') {
          for (const item of order.items) {
            if (item.type === 'product' && item.productId) {
              await this.prisma.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    increment: item.quantity
                  }
                }
              });
            } else if (item.type === 'support' && item.supportId) {
              const support = await this.prisma.support.findUnique({
                where: { id: item.supportId }
              });
              
              if (support && support.stock !== 999) {
                await this.prisma.support.update({
                  where: { id: item.supportId },
                  data: {
                    stock: {
                      increment: item.quantity
                    }
                  }
                });
              }
            } else if (item.type === 'coffret' && item.coffretId) {
              await this.prisma.coffret.update({
                where: { id: item.coffretId },
                data: {
                  stock: {
                    increment: item.quantity
                  }
                }
              });
            }
          }
        }
        break;
        
      default:
        throw new BadRequestException('Action non valide');
    }

    // Préparer les métadonnées pour l'historique
    const historyMetadata = {
      reason: validateOrderDto.reason,
      deliveryDate: validateOrderDto.deliveryDate,
      estimatedDelivery: validateOrderDto.estimatedDelivery,
      action: validateOrderDto.action,
      timestamp: new Date().toISOString()
    };

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        validatedBy: userId,
        validatedAt: validateOrderDto.action === 'validate' ? new Date() : null,
        rejectionReason: validateOrderDto.action === 'reject' ? validateOrderDto.reason : null,
        deliveryDate: validateOrderDto.deliveryDate,
        estimatedDelivery: validateOrderDto.estimatedDelivery,
        history: {
          create: {
            status: newStatus,
            action,
            description,
            userId,
            metadata: historyMetadata
          }
        }
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // ÉMISSION DE L'ÉVÉNEMENT DE CHANGEMENT DE STATUT
    this.eventEmitter.emit('order.status.changed', {
      order: updatedOrder,
      oldStatus: order.status,
      newStatus: updatedOrder.status,
      userId,
    });

    return updatedOrder;
  }

  async updateOrder(id: string, updateOrderDto: UpdateOrderDto, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // Préparer les métadonnées pour l'historique
    const historyMetadata = {
      ...updateOrderDto,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        ...updateOrderDto,
        history: {
          create: {
            status: updateOrderDto.status || order.status,
            action: 'updated',
            description: 'Mise à jour de la commande',
            userId,
            metadata: historyMetadata
          }
        }
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return updatedOrder;
  }

  async deleteOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // Ne pas supprimer les commandes complétées ou validées
    if (['COMPLETED', 'VALIDATED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException('Impossible de supprimer une commande validée ou complétée');
    }

    // Restaurer le stock si la commande était validée
    if (order.status === 'VALIDATED') {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: id }
      });
      
      for (const item of items) {
        if (item.type === 'product' && item.productId) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity
              }
            }
          });
        } else if (item.type === 'support' && item.supportId) {
          const support = await this.prisma.support.findUnique({
            where: { id: item.supportId }
          });
          
          if (support && support.stock !== 999) {
            await this.prisma.support.update({
              where: { id: item.supportId },
              data: {
                stock: {
                  increment: item.quantity
                }
              }
            });
          }
        } else if (item.type === 'coffret' && item.coffretId) {
          await this.prisma.coffret.update({
            where: { id: item.coffretId },
            data: {
              stock: {
                increment: item.quantity
              }
            }
          });
        }
      }
    }

    await this.prisma.order.delete({
      where: { id }
    });

    return { message: 'Commande supprimée avec succès' };
  }

  async getPendingOrders() {
    return this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        requiresValidation: true
      },
      include: {
        items: true,
        history: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getPendingOrdersCount(): Promise<number> {
    return this.prisma.order.count({
      where: {
        status: 'PENDING',
        requiresValidation: true,
      },
    });
  }

  async getOrderStats() {
    const [
      totalOrders,
      pendingOrders,
      validatedOrders,
      completedOrders,
      totalRevenue,
      todayOrders
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'VALIDATED' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { total: true }
      }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      totalOrders,
      pendingOrders,
      validatedOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      todayOrders
    };
  }

  async getCustomerOrders(phone: string) {
    return this.prisma.order.findMany({
      where: {
        customerPhone: phone
      },
      include: {
        items: {
          select: {
            name: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}