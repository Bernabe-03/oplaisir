// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
// import { PrismaClient } from '@prisma/client'

// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
//   constructor() {
//     super()
//   }

//   async onModuleInit() {
//     await this.$connect()
//   }

//   async onModuleDestroy() {
//     await this.$disconnect()
//   }
// }








import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { INestApplication } from '@nestjs/common';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    super({
      log: ['error', 'warn', 'info'],
      errorFormat: 'pretty',
      // La configuration du pool se fait via l'URL de connexion (paramètre connection_limit)
      // Exemple : DATABASE_URL="postgresql://...?connection_limit=5"
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('✅ Database connected successfully');

      // Écoute les erreurs de connexion
      (this as any).$on('error', (error: any) => {
        this.logger.error('Prisma Client error:', error);
        this.isConnected = false;
        setTimeout(() => this.reconnect(), 5000);
      });
    } catch (error: any) {
      this.reconnectAttempts++;
      this.logger.error(
        `❌ Failed to connect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
      this.logger.error(error?.message || error);

      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.logger.log(`Retrying in ${delay / 1000}s...`);
        setTimeout(() => this.connectWithRetry(), delay);
      } else {
        this.logger.error('🚨 Max reconnection attempts reached. Database connection failed.');
      }
    }
  }

  private async reconnect() {
    if (!this.isConnected) {
      this.logger.log('Attempting to reconnect to database...');
      await this.connectWithRetry();
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
      this.logger.log('🔄 Closing application...');
      await app.close();
    });
  }

  async onModuleDestroy() {
    this.logger.log('🔌 Disconnecting Prisma...');
    await this.$disconnect();
    this.isConnected = false;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}