import { Review } from './review.entity';

export class ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  verifiedPurchases: number;
}

export class ReviewResponse {
  review: Review;
  stats?: ReviewStats;
}