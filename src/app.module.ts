import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CoffretsModule } from './coffrets/coffrets.module';
import { SalesModule } from './sales/sales.module';
import { StockModule } from './stock/stock.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { SupportsModule } from './supports/supports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CoffretsModule,
    SalesModule,
    StockModule,
    AnalyticsModule,
    UsersModule,
    ReviewsModule,
    CloudinaryModule,
    SupportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}