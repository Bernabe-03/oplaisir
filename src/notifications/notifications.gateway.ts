import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger, Injectable } from '@nestjs/common';
  import { PrismaService } from '../shared/prisma/prisma.service';
  import { SoundsService } from './sounds.service';
  
  export interface Notification {
    id: string;
    type: 'order' | 'alert' | 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: any;
    timestamp: Date;
    read: boolean;
    sound?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }
  
  @Injectable()
  @WebSocketGateway({
    cors: {
      origin: process.env.FRONTEND_URL?.split(',') || [
        'http://localhost:5173',
        'https://oplaisir-gules.vercel.app'
      ],
      credentials: true,
    },
    namespace: '/notifications',
  })
  export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private readonly logger = new Logger(NotificationsGateway.name);
    private connectedClients: Map<string, Socket> = new Map();
    private adminRooms: Set<string> = new Set();
  
    constructor(
      private prisma: PrismaService,
      private soundsService: SoundsService,
    ) {
      this.setupPeriodicChecks();
    }
  
    afterInit(server: Server) {
      this.logger.log('🔔 Notifications WebSocket Gateway Initialized');
    }
  
    async handleConnection(client: Socket) {
      const userId = client.handshake.query.userId as string;
      const userRole = client.handshake.query.role as string;
  
      this.logger.log(`🔌 Client connecting: ${client.id}, User: ${userId}, Role: ${userRole}`);
  
      this.connectedClients.set(client.id, client);
  
      if (userRole === 'ADMIN' || userRole === 'MANAGER') {
        client.join('admin-room');
        this.adminRooms.add(client.id);
        this.logger.log(`👑 Admin ${userId} joined admin-room`);
  
        const pendingCount = await this.getPendingOrdersCount();
        client.emit('pending-orders-count', { 
          count: pendingCount,
          message: `Vous avez ${pendingCount} commande(s) en attente`
        });
        
        const notifications = await this.getUnreadNotifications(userId);
        client.emit('initial-notifications', notifications);
      }
  
      client.emit('connected', {
        message: 'Connecté au serveur de notifications',
        timestamp: new Date(),
      });
    }
  
    handleDisconnect(client: Socket) {
      this.logger.log(`🔌 Client disconnected: ${client.id}`);
      this.connectedClients.delete(client.id);
      this.adminRooms.delete(client.id);
    }
  
    @SubscribeMessage('join-admin-room')
    async handleJoinAdminRoom(@ConnectedSocket() client: Socket) {
      client.join('admin-room');
      this.adminRooms.add(client.id);
      
      const pendingCount = await this.getPendingOrdersCount();
      client.emit('pending-orders-count', { 
        count: pendingCount,
        message: `Vous avez ${pendingCount} commande(s) en attente`
      });
      
      return { success: true, message: 'Rejoint la salle admin' };
    }
  
    @SubscribeMessage('mark-as-read')
    async handleMarkAsRead(@MessageBody() data: { notificationId: string }, @ConnectedSocket() client: Socket) {
      try {
        await this.prisma.notification.update({
          where: { id: data.notificationId },
          data: { read: true, readAt: new Date() },
        });
        
        client.emit('notification-read', { notificationId: data.notificationId });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    } 
  
    @SubscribeMessage('get-pending-count')
    async handleGetPendingCount(@ConnectedSocket() client: Socket) {
      const count = await this.getPendingOrdersCount();
      return { count };
    }
  
    async notifyNewOrder(order: any) {
      try {
        const pendingCount = await this.getPendingOrdersCount();
        
        const notification = await this.prisma.notification.create({
          data: {
            type: 'order',
            title: 'Nouvelle Commande',
            message: `Nouvelle commande #${order.orderNumber} de ${order.customerName}`,
            data: order,
            priority: 'high',
            sound: 'order-notification.mp3',
            userId: null,
          },
        });
  
        const notificationMessage = `Vous avez ${pendingCount} commande(s) en attente. Nouvelle commande #${order.orderNumber} - ${order.customerName}`;
        
        let soundConfig;
        try {
          soundConfig = this.soundsService.generateNotificationSound('order-notification', pendingCount);
        } catch (error) {
          soundConfig = { file: 'order-notification.mp3', duration: 3000, volume: 0.7 };
        }
  
        this.server.to('admin-room').emit('new-order', {
          notification: {
            id: notification.id,
            type: 'order',
            title: '📦 Nouvelle Commande',
            message: notificationMessage,
            data: order,
            timestamp: new Date(),
            read: false,
            sound: soundConfig.file,
            priority: 'high',
          },
          pendingCount,
          order: order,
          sound: soundConfig,
        });
  
        this.server.to('admin-room').emit('pending-orders-count', { 
          count: pendingCount,
          message: `Vous avez ${pendingCount} commande(s) en attente`,
          sound: pendingCount > 0 ? 'pending-alert.mp3' : null,
        });
  
        this.logger.log(`📢 Notification envoyée pour nouvelle commande: ${order.orderNumber}`);
        
        return notification;
      } catch (error) {
        this.logger.error('❌ Erreur notification nouvelle commande:', error);
      }
    }
  
    sendNotification(notification: Partial<Notification>) {
      const fullNotification: Notification = {
        id: Date.now().toString(),
        type: notification.type || 'info',
        title: notification.title || 'Notification',
        message: notification.message || '',
        data: notification.data,
        timestamp: new Date(),
        read: false,
        sound: notification.sound,
        priority: notification.priority || 'medium',
      };
  
      this.server.to('admin-room').emit('notification', fullNotification);
      
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        this.server.to('admin-room').emit('alert', {
          ...fullNotification,
          urgent: notification.priority === 'urgent',
        });
      }
  
      return fullNotification;
    }
  
    private setupPeriodicChecks() {
      setInterval(async () => {
        await this.checkPendingOrders();
      }, 30000);
    }
  
    private async checkPendingOrders() {
      try {
        const count = await this.getPendingOrdersCount();
        
        if (count > 0) {
          this.server.to('admin-room').emit('pending-check', {
            count,
            timestamp: new Date(),
            message: `Rappel: ${count} commande(s) en attente de validation`,
          });
        }
      } catch (error) {
        this.logger.error('❌ Erreur vérification commandes en attente:', error);
      }
    }
  
    private async getPendingOrdersCount(): Promise<number> {
      return this.prisma.order.count({
        where: {
          status: 'PENDING',
          requiresValidation: true,
        },
      });
    }
  
    private async getUnreadNotifications(userId?: string) {
      const where: any = { read: false };
      
      if (userId) {
        where.userId = userId;
      } else {
        where.userId = null;
      }
  
      return this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }
  }















// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   MessageBody,
//   ConnectedSocket,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Logger, Injectable } from '@nestjs/common';
// import { PrismaService } from '../shared/prisma/prisma.service';
// import { SoundsService } from './sounds.service';

// export interface Notification {
//   id: string;
//   type: 'order' | 'alert' | 'info' | 'success' | 'warning' | 'error';
//   title: string;
//   message: string;
//   data?: any;
//   timestamp: Date;
//   read: boolean;
//   sound?: string;
//   priority?: 'low' | 'medium' | 'high' | 'urgent';
// }

// @Injectable()
// @WebSocketGateway({
//   cors: {
//     origin: process.env.FRONTEND_URL?.split(',') || [
//       'http://localhost:5173',
//       'https://oplaisir-gules.vercel.app',
//     ],
//     credentials: true,
//   },
//   namespace: '/notifications',
// })
// export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   @WebSocketServer()
//   server: Server;

//   private readonly logger = new Logger(NotificationsGateway.name);
//   private connectedClients: Map<string, Socket> = new Map();
//   private adminRooms: Set<string> = new Set();
//   private consecutiveDbErrors = 0; // Compteur d'erreurs DB consécutives

//   constructor(
//     private prisma: PrismaService,
//     private soundsService: SoundsService,
//   ) {
//     this.setupPeriodicChecks();
//   }

//   afterInit(server: Server) {
//     this.logger.log('🔔 Notifications WebSocket Gateway Initialized');
//   }

//   async handleConnection(client: Socket) {
//     const userId = client.handshake.query.userId as string;
//     const userRole = client.handshake.query.role as string;

//     this.logger.log(`🔌 Client connecting: ${client.id}, User: ${userId}, Role: ${userRole}`);

//     this.connectedClients.set(client.id, client);

//     if (userRole === 'ADMIN' || userRole === 'MANAGER') {
//       client.join('admin-room');
//       this.adminRooms.add(client.id);
//       this.logger.log(`👑 Admin ${userId} joined admin-room`);

//       try {
//         const pendingCount = await this.getPendingOrdersCount();
//         client.emit('pending-orders-count', {
//           count: pendingCount,
//           message: `Vous avez ${pendingCount} commande(s) en attente`,
//         });

//         const notifications = await this.getUnreadNotifications(userId);
//         client.emit('initial-notifications', notifications);
//       } catch (error) {
//         this.logger.error(`Erreur lors de l'envoi des données initiales à l'admin ${userId}:`, error);
//         client.emit('error', { message: 'Impossible de récupérer les données initiales' });
//       }
//     }

//     client.emit('connected', {
//       message: 'Connecté au serveur de notifications',
//       timestamp: new Date(),
//     });
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`🔌 Client disconnected: ${client.id}`);
//     this.connectedClients.delete(client.id);
//     this.adminRooms.delete(client.id);
//   }

//   @SubscribeMessage('join-admin-room')
//   async handleJoinAdminRoom(@ConnectedSocket() client: Socket) {
//     client.join('admin-room');
//     this.adminRooms.add(client.id);

//     try {
//       const pendingCount = await this.getPendingOrdersCount();
//       client.emit('pending-orders-count', {
//         count: pendingCount,
//         message: `Vous avez ${pendingCount} commande(s) en attente`,
//       });
//       return { success: true, message: 'Rejoint la salle admin' };
//     } catch (error) {
//       this.logger.error('Erreur lors de la récupération du nombre de commandes en attente:', error);
//       return { success: false, message: 'Erreur base de données' };
//     }
//   }

//   @SubscribeMessage('mark-as-read')
//   async handleMarkAsRead(@MessageBody() data: { notificationId: string }, @ConnectedSocket() client: Socket) {
//     try {
//       await this.prisma.notification.update({
//         where: { id: data.notificationId },
//         data: { read: true, readAt: new Date() },
//       });

//       client.emit('notification-read', { notificationId: data.notificationId });
//       return { success: true };
//     } catch (error) {
//       this.logger.error(`Erreur lors du marquage de la notification ${data.notificationId}:`, error);
//       return { success: false, error: error.message };
//     }
//   }

//   @SubscribeMessage('get-pending-count')
//   async handleGetPendingCount(@ConnectedSocket() client: Socket) {
//     try {
//       const count = await this.getPendingOrdersCount();
//       return { count };
//     } catch (error) {
//       this.logger.error('Erreur lors de la récupération du nombre de commandes en attente:', error);
//       return { count: 0, error: 'Impossible de récupérer le nombre' };
//     }
//   }

//   async notifyNewOrder(order: any) {
//     try {
//       const pendingCount = await this.getPendingOrdersCount();

//       const notification = await this.prisma.notification.create({
//         data: {
//           type: 'order',
//           title: 'Nouvelle Commande',
//           message: `Nouvelle commande #${order.orderNumber} de ${order.customerName}`,
//           data: order,
//           priority: 'high',
//           sound: 'order-notification.mp3',
//           userId: null,
//         },
//       });

//       const notificationMessage = `Vous avez ${pendingCount} commande(s) en attente. Nouvelle commande #${order.orderNumber} - ${order.customerName}`;

//       let soundConfig;
//       try {
//         soundConfig = this.soundsService.generateNotificationSound('order-notification', pendingCount);
//       } catch (error) {
//         soundConfig = { file: 'order-notification.mp3', duration: 3000, volume: 0.7 };
//       }

//       this.server.to('admin-room').emit('new-order', {
//         notification: {
//           id: notification.id,
//           type: 'order',
//           title: '📦 Nouvelle Commande',
//           message: notificationMessage,
//           data: order,
//           timestamp: new Date(),
//           read: false,
//           sound: soundConfig.file,
//           priority: 'high',
//         },
//         pendingCount,
//         order: order,
//         sound: soundConfig,
//       });

//       this.server.to('admin-room').emit('pending-orders-count', {
//         count: pendingCount,
//         message: `Vous avez ${pendingCount} commande(s) en attente`,
//         sound: pendingCount > 0 ? 'pending-alert.mp3' : null,
//       });

//       this.logger.log(`📢 Notification envoyée pour nouvelle commande: ${order.orderNumber}`);

//       return notification;
//     } catch (error) {
//       this.logger.error('❌ Erreur notification nouvelle commande:', error);
//       // On peut quand même tenter d'envoyer une notification simplifiée sans passer par la BDD
//       this.server.to('admin-room').emit('new-order', {
//         notification: {
//           id: `temp-${Date.now()}`,
//           type: 'order',
//           title: '📦 Nouvelle Commande',
//           message: `Nouvelle commande #${order.orderNumber} de ${order.customerName}`,
//           data: order,
//           timestamp: new Date(),
//           read: false,
//           sound: 'order-notification.mp3',
//           priority: 'high',
//         },
//         pendingCount: '?',
//         order: order,
//         sound: { file: 'order-notification.mp3', duration: 3000, volume: 0.7 },
//       });
//     }
//   }

//   sendNotification(notification: Partial<Notification>) {
//     const fullNotification: Notification = {
//       id: Date.now().toString(),
//       type: notification.type || 'info',
//       title: notification.title || 'Notification',
//       message: notification.message || '',
//       data: notification.data,
//       timestamp: new Date(),
//       read: false,
//       sound: notification.sound,
//       priority: notification.priority || 'medium',
//     };

//     this.server.to('admin-room').emit('notification', fullNotification);

//     if (notification.priority === 'high' || notification.priority === 'urgent') {
//       this.server.to('admin-room').emit('alert', {
//         ...fullNotification,
//         urgent: notification.priority === 'urgent',
//       });
//     }

//     return fullNotification;
//   }

//   private setupPeriodicChecks() {
//     setInterval(async () => {
//       await this.checkPendingOrders();
//     }, 30000); // Toutes les 30 secondes
//   }

//   private async checkPendingOrders() {
//     try {
//       const count = await this.getPendingOrdersCount();

//       // Réinitialiser le compteur d'erreurs DB en cas de succès
//       this.consecutiveDbErrors = 0;

//       if (count > 0) {
//         this.server.to('admin-room').emit('pending-check', {
//           count,
//           timestamp: new Date(),
//           message: `Rappel: ${count} commande(s) en attente de validation`,
//         });
//       }
//     } catch (error) {
//       this.consecutiveDbErrors++;
//       this.logger.error(`❌ Erreur vérification commandes en attente (tentative ${this.consecutiveDbErrors}):`, error);

//       // Option : si trop d'erreurs consécutives, on pourrait allonger l'intervalle
//       if (this.consecutiveDbErrors > 5) {
//         this.logger.warn('🚨 Trop d\'erreurs DB consécutives, les vérifications périodiques seront peut-être moins fiables');
//       }
//     }
//   }

//   private async getPendingOrdersCount(): Promise<number> {
//     try {
//       const count = await this.prisma.order.count({
//         where: {
//           status: 'PENDING',
//           requiresValidation: true,
//         },
//       });
//       return count;
//     } catch (error) {
//       this.logger.error('Erreur dans getPendingOrdersCount:', error);
//       // En cas d'erreur, on retourne 0 pour éviter de bloquer, mais on propage pour que l'appelant sache
//       throw error; // On relance pour que le traitement appelant puisse gérer
//     }
//   }

//   private async getUnreadNotifications(userId?: string) {
//     try {
//       const where: any = { read: false };
//       if (userId) {
//         where.userId = userId;
//       } else {
//         where.userId = null;
//       }

//       return await this.prisma.notification.findMany({
//         where,
//         orderBy: { createdAt: 'desc' },
//         take: 20,
//       });
//     } catch (error) {
//       this.logger.error('Erreur dans getUnreadNotifications:', error);
//       return []; // Retourne un tableau vide en cas d'erreur
//     }
//   }
// }