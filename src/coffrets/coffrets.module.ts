import { Module } from '@nestjs/common';
import { CoffretsService } from './coffrets.service';
import { CoffretsController } from './coffrets.controller';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { CloudinaryModule } from '../shared/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [CoffretsController],
  providers: [CoffretsService],
  exports: [CoffretsService],
})
export class CoffretsModule {}