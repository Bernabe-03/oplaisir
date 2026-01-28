import { ReviewStatus } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

class ProductInfoDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  sku: string;

  @Expose()
  images: string[];
}

class UserInfoDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;
}

export class ReviewResponseDto {
  @Expose()
  id: string;

  @Expose()
  rating: number;

  @Expose()
  title?: string;

  @Expose()
  comment: string;

  @Expose()
  customerName: string;

  @Expose()
  customerEmail?: string;

  @Expose()
  status: ReviewStatus;

  @Expose()
  images: string[];

  @Expose()
  isVerifiedPurchase: boolean;

  @Expose()
  helpfulCount: number;

  @Expose()
  @Type(() => ProductInfoDto)
  product?: ProductInfoDto;

  @Expose()
  @Type(() => UserInfoDto)
  user?: UserInfoDto;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  publishedAt?: Date;

  @Expose()
  get isPublished(): boolean {
    return this.status === ReviewStatus.APPROVED && !!this.publishedAt;
  }

  @Expose()
  get daysAgo(): number {
    const now = new Date();
    const created = new Date(this.createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}