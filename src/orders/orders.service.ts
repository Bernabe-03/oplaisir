
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ValidateOrderDto } from './dto/validate-order.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsGateway } from '../notifications/notifications.gateway';

type OrderStatus = 'PENDING' | 'VALIDATED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED' | 'DELIVERED';
type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'FAILED' | 'REFUNDED';

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

  /**
   * Décrémente le stock des produits, supports et coffrets dans une transaction.
   * Utilise update avec vérification préalable pour garantir l'intégrité.
   */
  private async decrementStockInTransaction(prisma: any, items: any[]) {
    console.log('🚚 [decrementStockInTransaction] Début de la décrémentation...');
    for (const item of items) {
      if (!item.id || !item.type) {
        throw new BadRequestException(`Item invalide : ${JSON.stringify(item)}`);
      }
      console.log(`🔍 Décrémentation pour: ${item.type} ${item.id} - ${item.name} (${item.quantity})`);

      if (item.type === 'product') {
        // Vérifier que le produit existe et a assez de stock
        const product = await prisma.product.findUnique({
          where: { id: item.id },
        });
        if (!product) {
          throw new BadRequestException(`Produit ${item.name} (ID: ${item.id}) non trouvé`);
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour le produit ${item.name}. Disponible: ${product.stock}, Demandé: ${item.quantity}`
          );
        }
        // Mise à jour atomique
        const updated = await prisma.product.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } },
        });
        console.log(`📦 Après: stock produit ${item.id} = ${updated.stock}`);
      } 
      else if (item.type === 'support') {
        const support = await prisma.support.findUnique({ where: { id: item.id } });
        if (!support) {
          throw new BadRequestException(`Support ${item.name} (ID: ${item.id}) non trouvé`);
        }
        if (support.stock === 999) {
          console.log(`⚠️ Support ${item.id} a stock illimité, pas de décrémentation`);
          continue; // Ne pas décrémenter
        }
        if (support.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour le support ${item.name}. Disponible: ${support.stock}, Demandé: ${item.quantity}`
          );
        }
        const updated = await prisma.support.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } },
        });
        console.log(`📦 Après: stock support ${item.id} = ${updated.stock}`);
      } 
      else if (item.type === 'coffret') {
        const coffret = await prisma.coffret.findUnique({ where: { id: item.id } });
        if (!coffret) {
          throw new BadRequestException(`Coffret ${item.name} (ID: ${item.id}) non trouvé`);
        }
        if (coffret.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour le coffret ${item.name}. Disponible: ${coffret.stock}, Demandé: ${item.quantity}`
          );
        }
        const updated = await prisma.coffret.update({
          where: { id: item.id },
          data: { stock: { decrement: item.quantity } },
        });
        console.log(`📦 Après: stock coffret ${item.id} = ${updated.stock}`);
      }
    }
    console.log('✅ [decrementStockInTransaction] Fin de la décrémentation');
  }

  private async restoreStock(orderId: string) {
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      try {
        if (item.type === 'product' && item.productId) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
          console.log(`🔄 Stock produit ${item.productId} restauré de ${item.quantity}`);
        } 
        else if (item.type === 'support' && item.supportId) {
          const support = await this.prisma.support.findUnique({ where: { id: item.supportId } });
          if (support && support.stock !== 999) {
            await this.prisma.support.update({
              where: { id: item.supportId },
              data: { stock: { increment: item.quantity } }
            });
            console.log(`🔄 Stock support ${item.supportId} restauré de ${item.quantity}`);
          }
        } 
        else if (item.type === 'coffret' && item.coffretId) {
          await this.prisma.coffret.update({
            where: { id: item.coffretId },
            data: { stock: { increment: item.quantity } }
          });
          console.log(`🔄 Stock coffret ${item.coffretId} restauré de ${item.quantity}`);
        }
      } catch (error) {
        console.error(`❌ Erreur restauration ${item.type} ${item.productId || item.supportId || item.coffretId}:`, error);
      }
    }
  }

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
    console.log('🚀🚀🚀 [createOrder] DÉBUT DE LA MÉTHODE 🚀🚀🚀');
    // 1. Normalisation
    const normalizedItems = await this.normalizeOrderItems(createOrderDto.items);
    createOrderDto.items = normalizedItems;
    console.log('📋 Items reçus après normalisation :', JSON.stringify(createOrderDto.items, null, 2));

    // 2. Validation préalable (stock et existence)
    for (const item of createOrderDto.items) {
      if (!item.id || !item.type) {
        throw new BadRequestException(`Item invalide : ${JSON.stringify(item)}`);
      }

      if (item.type === 'product') {
        const product = await this.prisma.product.findUnique({ where: { id: item.id } });
        if (!product) throw new BadRequestException(`Produit ${item.name} (ID: ${item.id}) non trouvé`);
        if (product.stock < item.quantity) {
          throw new BadRequestException(`Stock insuffisant pour ${product.name}. Disponible: ${product.stock}, Demandé: ${item.quantity}`);
        }
      }
      
      if (item.type === 'support') {
        let support: any = null;
        if (item.id) support = await this.prisma.support.findUnique({ where: { id: item.id } });
        if (!support && item.sku) support = await this.prisma.support.findUnique({ where: { sku: item.sku } });
        if (!support && item.name) {
          const supports = await this.prisma.support.findMany({
            where: {
              OR: [
                { name: { contains: item.name, mode: 'insensitive' } },
                { name: { contains: item.name.replace('support', '').trim(), mode: 'insensitive' } }
              ]
            }
          });
          if (supports.length) support = supports[0];
        }
        
        if (!support) {
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
          } else {
            throw new BadRequestException(`Support "${item.name}" (ID: ${item.id}, SKU: ${item.sku}) non trouvé dans la base de données`);
          }
        }
        item.id = support.id;
        if (support.stock < item.quantity && support.stock !== 999) {
          throw new BadRequestException(`Stock insuffisant pour le support ${support.name}. Disponible: ${support.stock}, Demandé: ${item.quantity}`);
        }
      }
      
      if (item.type === 'coffret') {
        const coffret = await this.prisma.coffret.findUnique({ where: { id: item.id } });
        if (!coffret) throw new BadRequestException(`Coffret ${item.name} (ID: ${item.id}) non trouvé`);
        if (coffret.stock < item.quantity) {
          throw new BadRequestException(`Stock insuffisant pour ${coffret.name}. Disponible: ${coffret.stock}, Demandé: ${item.quantity}`);
        }
      }
    }

    const orderNumber = await this.generateOrderNumber();
    const subtotal = createOrderDto.subtotal || createOrderDto.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = createOrderDto.discount?.amount || 0;
    const total = createOrderDto.total || (subtotal - discountAmount + createOrderDto.deliveryCost);

    // 3. Transaction
    try {
      console.log('🔄 Début de la transaction Prisma...');
      const order = await this.prisma.$transaction(async (prisma) => {
        // Création de la commande
        const newOrder = await prisma.order.create({
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
                if (item.type === 'product') itemData.productId = item.id;
                else if (item.type === 'coffret') itemData.coffretId = item.id;
                else if (item.type === 'support') itemData.supportId = item.id;
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
          include: { items: true, history: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });

        // Décrémentation du stock
        await this.decrementStockInTransaction(prisma, createOrderDto.items);
        console.log(`✅ Stock décrémenté pour la commande ${orderNumber}`);
        return newOrder;
      });

      // Après la transaction, relire les stocks pour vérifier
      console.log('🔍 Vérification post-transaction :');
      for (const item of createOrderDto.items) {
        if (item.type === 'product') {
          const product = await this.prisma.product.findUnique({ where: { id: item.id } });
          console.log(`   - Produit ${item.name} (${item.id}) : stock actuel = ${product?.stock}`);
        } else if (item.type === 'support') {
          const support = await this.prisma.support.findUnique({ where: { id: item.id } });
          if (support && support.stock !== 999) {
            console.log(`   - Support ${item.name} (${item.id}) : stock actuel = ${support?.stock}`);
          }
        } else if (item.type === 'coffret') {
          const coffret = await this.prisma.coffret.findUnique({ where: { id: item.id } });
          console.log(`   - Coffret ${item.name} (${item.id}) : stock actuel = ${coffret?.stock}`);
        }
      }

      // Notifications
      this.eventEmitter.emit('order.created', order);
      await this.notificationsGateway.notifyNewOrder(order);
      console.log(`📢 Commande ${order.orderNumber} créée et stock mis à jour.`);
      return order;
    } catch (error) {
      console.error('❌ Échec de la transaction :', error);
      throw new BadRequestException(`Erreur lors de la création de la commande : ${error.message}`);
    }
  }

  async normalizeOrderItems(items: any[]): Promise<NormalizedOrderItem[]> {
    const normalizedItems: NormalizedOrderItem[] = [];
    for (const item of items) {
      const normalizedItem: NormalizedOrderItem = { ...item };
      if (item.sku && (item.sku.startsWith('SUP-') || item.sku.startsWith('SUPP-'))) {
        normalizedItem.type = 'support';
        if (item.id) {
          const existingSupport = await this.prisma.support.findUnique({ where: { id: item.id } });
          if (!existingSupport && item.sku) {
            const supportBySku = await this.prisma.support.findUnique({ where: { sku: item.sku } });
            if (supportBySku) normalizedItem.id = supportBySku.id;
          }
        }
      }
      if (item.sku && item.sku.startsWith('COF-')) {
        normalizedItem.type = 'coffret';
      }
      if (item.name && item.name.toLowerCase().includes('support') && item.type === 'product') {
        normalizedItem.type = 'support';
      }
      if (item.metadata && (item.metadata.type === 'boite' || item.metadata.type === 'support')) {
        normalizedItem.type = 'support';
      }
      normalizedItems.push(normalizedItem);
    }
    console.log('📋 Items normalisés:', {
      total: normalizedItems.length,
      byType: normalizedItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    return normalizedItems;
  }

  async getOrders(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as OrderStatus } : {};
    
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          history: { orderBy: { createdAt: 'desc' }, take: 5 }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, coffret: true, support: true } },
        history: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } },
        user: { select: { id: true, name: true, email: true, phone: true } }
      }
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: { include: { product: true, coffret: true, support: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    return order;
  }

  async validateOrder(id: string, validateOrderDto: ValidateOrderDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    let newStatus: OrderStatus;
    let description: string;
    let action: string;

    switch (validateOrderDto.action) {
      case 'validate':
        newStatus = 'VALIDATED';
        action = 'validated';
        description = 'Commande validée par l\'administrateur';
        break;
        
      case 'reject':
        newStatus = 'REJECTED';
        action = 'rejected';
        description = `Commande rejetée: ${validateOrderDto.reason}`;
        await this.restoreStock(order.id);
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
        if (order.status === 'PENDING' || order.status === 'VALIDATED') {
          await this.restoreStock(order.id);
        }
        break;
        
      default:
        throw new BadRequestException('Action non valide');
    }

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
      include: { history: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    this.eventEmitter.emit('order.status.changed', {
      order: updatedOrder,
      oldStatus: order.status,
      newStatus: updatedOrder.status,
      userId,
    });

    return updatedOrder;
  }

  async updateOrder(id: string, updateOrderDto: UpdateOrderDto, userId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Commande non trouvée');

    const historyMetadata = { ...updateOrderDto, updatedAt: new Date().toISOString(), updatedBy: userId };

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
      include: { history: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    return updatedOrder;
  }

  async deleteOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Commande non trouvée');

    if (['COMPLETED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException('Impossible de supprimer une commande complétée ou livrée');
    }

    await this.restoreStock(order.id);

    await this.prisma.order.delete({ where: { id } });
    return { message: 'Commande supprimée avec succès' };
  }

  async getPendingOrders() {
    return this.prisma.order.findMany({
      where: { status: 'PENDING', requiresValidation: true },
      include: {
        items: true,
        history: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getPendingOrdersCount(): Promise<number> {
    return this.prisma.order.count({
      where: { status: 'PENDING', requiresValidation: true }
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
      where: { customerPhone: phone },
      include: {
        items: {
          select: { name: true, quantity: true, unitPrice: true, totalPrice: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}