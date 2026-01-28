// import { Module } from '@nestjs/common';
// import { ProductsController } from './products.controller';
// import { ProductsService } from './products.service';
// import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
// import { PrismaModule } from '../shared/prisma/prisma.module';

// @Module({
//   imports: [PrismaModule],
//   controllers: [ProductsController],
//   providers: [ProductsService, CloudinaryService],
//   exports: [ProductsService],
// })
// export class ProductsModule {}





import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { ReviewsModule } from '../reviews/reviews.module'; // Ajoutez cette importation

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ReviewsModule), // Utilisez forwardRef pour éviter les dépendances circulaires
  ],
  controllers: [ProductsController],
  providers: [ProductsService, CloudinaryService],
  exports: [ProductsService],
})
export class ProductsModule {}