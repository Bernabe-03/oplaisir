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

  constructor() {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error: any) {
      this.logger.error('❌ Failed to connect to database');
      this.logger.error(error?.message || error);
    }
  }

  // ✅ Correction du typage ici
  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
      this.logger.log('🔄 Closing application...');
      await app.close();
    });
  }

  async onModuleDestroy() {
    this.logger.log('🔌 Disconnecting Prisma...');
    await this.$disconnect();
  }
}