// src/notifications/notifications.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { SoundsService } from './sounds.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule,
    forwardRef(() => OrdersModule), 
  ],
  providers: [NotificationsGateway, NotificationsService, SoundsService],
  controllers: [NotificationsController],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}