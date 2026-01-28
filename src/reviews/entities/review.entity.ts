import { Review as PrismaReview, ReviewStatus } from '@prisma/client';
import { Exclude, Expose, Transform } from 'class-transformer';

export class Review implements PrismaReview {
  id: string;
  productId: string;
  userId: string | null;
  
  rating: number;
  title: string | null;
  comment: string;
  
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  
  status: ReviewStatus;
  images: string[];
  
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;

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