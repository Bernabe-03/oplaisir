export interface ReviewStats {
    productId: string;
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    verifiedPurchases: number;
    reviewsWithImages: number;
    latestReview?: Date;
  }
  
  export interface ProductReviewSummary {
    productId: string;
    averageRating: number;
    totalReviews: number;
    rating: number;
  }