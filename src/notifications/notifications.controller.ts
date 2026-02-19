import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
    UseGuards,
    Request,
  } from '@nestjs/common';
  import { NotificationsService } from './notifications.service';
  import { JwtAuthGuard } from '../auth/guards/jwt.guard';
  import { RolesGuard } from '../auth/guards/roles.guard';
  import { Roles } from '../auth/decorators/roles.decorator';
  
  @Controller('notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  export class NotificationsController {
    constructor(private notificationsService: NotificationsService) {}
  
    @Get()
    async getNotifications(
      @Request() req,
      @Query('page') page: number = 1,
      @Query('limit') limit: number = 50,
      @Query('unreadOnly') unreadOnly: boolean = false,
    ) {
      const userId = req.user.id;
      return this.notificationsService.getNotifications(userId, {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: unreadOnly === true,
      });
    }
  
    @Get('unread-count')
    async getUnreadCount(@Request() req) {
      const userId = req.user.id;
      return {
        count: await this.notificationsService.getUnreadCount(userId),
      };
    }
  
    @Get('pending-count')
    @Roles('ADMIN', 'MANAGER')
    async getPendingOrdersCount() {
      return {
        count: await this.notificationsService.getPendingOrdersCount(),
      };
    }
  
    @Put(':id/read')
    async markAsRead(@Param('id') id: string) {
      return this.notificationsService.markAsRead(id);
    }
  
    @Post('mark-all-read')
    async markAllAsRead(@Request() req) {
      const userId = req.user.id;
      return this.notificationsService.markAllAsRead(userId);
    }
  
    @Delete(':id')
    async deleteNotification(@Param('id') id: string) {
      // Implémentez la suppression si nécessaire
      return { message: 'Notification deleted' };
    }
  
    @Get('test')
    @Roles('ADMIN')
    async testNotification() {
      // Pour tester les notifications
      const testOrder = {
        id: 'test-' + Date.now(),
        orderNumber: 'CMD-TEST-001',
        customerName: 'Client Test',
        total: 50000,
        items: [{ name: 'Produit Test', quantity: 2, price: 25000 }],
      };
  
      await this.notificationsService.handleNewOrder(testOrder);
      
      return {
        success: true,
        message: 'Test notification sent',
        order: testOrder,
      };
    }
  }