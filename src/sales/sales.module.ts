import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesRepository } from './repositories/sales.repository';
import { PrismaService } from '../shared/prisma/prisma.service'; 

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesRepository, PrismaService],
  exports: [SalesService],
})
export class SalesModule {}