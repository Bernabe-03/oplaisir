import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NotificationData {
  type: 'order' | 'alert' | 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  userId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  sound?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Écouter les événements de création de commande
    this.eventEmitter.on('order.created', async (order) => {
      await this.handleNewOrder(order);
    });

    // Écouter les changements de statut des commandes
    this.eventEmitter.on('order.status.changed', async ({ order, oldStatus, newStatus }) => {
      await this.handleOrderStatusChange(order, oldStatus, newStatus);
    });
  }

  async handleNewOrder(order: any) {
    // La notification est déjà envoyée par le gateway
    // On crée juste une notification persistante
    await this.createNotification({
      type: 'order',
      title: 'Nouvelle Commande',
      message: `Nouvelle commande #${order.orderNumber} reçue de ${order.customerName}`,
      data: order,
      priority: 'high',
      sound: 'order-notification.mp3',
    });
  }

  async handleOrderStatusChange(order: any, oldStatus: string, newStatus: string) {
    let notificationType: 'info' | 'success' | 'warning' = 'info';
    let title = 'Statut Commande Modifié';
    let message = `Commande #${order.orderNumber}: ${this.getStatusLabel(oldStatus)} → ${this.getStatusLabel(newStatus)}`;
    let priority: 'low' | 'medium' | 'high' = 'medium';

    switch (newStatus) {
      case 'VALIDATED':
        notificationType = 'success';
        title = 'Commande Validée';
        message = `Commande #${order.orderNumber} a été validée`;
        priority = 'medium';
        break;
      case 'REJECTED':
        notificationType = 'warning';
        title = 'Commande Rejetée';
        message = `Commande #${order.orderNumber} a été rejetée`;
        priority = 'high';
        break;
      case 'DELIVERED':
        notificationType = 'success';
        title = 'Commande Livrée';
        message = `Commande #${order.orderNumber} a été livrée à ${order.customerName}`;
        priority = 'low';
        break;
    }

    // Envoyer via WebSocket
    this.notificationsGateway.sendNotification({
      type: notificationType,
      title,
      message,
      data: order,
      priority,
    });

    // Créer notification persistante
    await this.createNotification({
      type: notificationType,
      title,
      message,
      data: order,
      priority,
    });
  }

  async createNotification(data: NotificationData) {
    return this.prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        priority: data.priority || 'medium',
        sound: data.sound,
        userId: data.userId,
        read: false,
      },
    });
  }

  async getNotifications(userId?: string, options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (userId) {
      where.OR = [
        { userId },
        { userId: null },
      ];
    }

    if (options?.unreadOnly) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId?: string) {
    const where: any = { read: false };
    
    if (userId) {
      where.userId = userId;
    }

    return this.prisma.notification.updateMany({
      where,
      data: { read: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId?: string) {
    const where: any = { read: false };
    
    if (userId) {
      where.OR = [
        { userId },
        { userId: null },
      ];
    }

    return this.prisma.notification.count({ where });
  }

  async getPendingOrdersCount() {
    return this.prisma.order.count({
      where: {
        status: 'PENDING',
        requiresValidation: true,
      },
    });
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'En attente',
      'VALIDATED': 'Validée',
      'REJECTED': 'Rejetée',
      'COMPLETED': 'Complétée',
      'CANCELLED': 'Annulée',
      'DELIVERED': 'Livrée',
    };
    return labels[status] || status;
  }
}