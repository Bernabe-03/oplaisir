import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma, ReviewStatus } from '@prisma/client';
import { ReviewQueryDto, ReviewSortBy } from '../dto/review-query.dto';
import { ReviewStats } from '../interfaces/review-stats.interface';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ReviewUncheckedCreateInput) {
    return this.prisma.review.create({
      data,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findByProductId(productId: string, query: ReviewQueryDto) {
    const { 
      page = 1, 
      limit = 10, 
      rating, 
      status,
      sortBy = ReviewSortBy.NEWEST,
      verifiedOnly,
      withImagesOnly,
      search 
    } = query;

    const skip = (page - 1) * limit;
    
    const where: Prisma.ReviewWhereInput = {
      productId,
      ...(rating && { rating }),
      ...(status && { status }),
      ...(verifiedOnly && { isVerifiedPurchase: true }),
      ...(withImagesOnly && { images: { isEmpty: false } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { comment: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ReviewOrderByWithRelationInput = {};
    switch (sortBy) {
      case ReviewSortBy.HELPFUL:
        orderBy.helpfulCount = 'desc';
        break;
      case ReviewSortBy.HIGHEST_RATING:
        orderBy.rating = 'desc';
        break;
      case ReviewSortBy.LOWEST_RATING:
        orderBy.rating = 'asc';
        break;
      case ReviewSortBy.NEWEST:
      default:
        orderBy.createdAt = 'desc';
        break;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, data: Prisma.ReviewUncheckedUpdateInput) {
    return this.prisma.review.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.review.delete({
      where: { id },
    });
  }

  async markAsHelpful(id: string) {
    return this.prisma.review.update({
      where: { id },
      data: {
        helpfulCount: { increment: 1 },
      },
    });
  }

  async updateStatus(id: string, status: ReviewStatus) {
    const data: Prisma.ReviewUncheckedUpdateInput = { status };
    
    if (status === ReviewStatus.APPROVED) {
      data.publishedAt = new Date();
    }

    return this.prisma.review.update({
      where: { id },
      data,
    });
  }

  async getProductStats(productId: string): Promise<ReviewStats> {
    const reviews = await this.prisma.review.findMany({
      where: {
        productId,
        status: ReviewStatus.APPROVED,
      },
      select: {
        rating: true,
        isVerifiedPurchase: true,
        images: true,
        createdAt: true,
      },
    });

    if (reviews.length === 0) {
      return {
        productId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedPurchases: 0,
        reviewsWithImages: 0,
      };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = parseFloat((sum / total).toFixed(1));

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    const verifiedPurchases = reviews.filter(r => r.isVerifiedPurchase).length;
    const reviewsWithImages = reviews.filter(r => r.images.length > 0).length;
    const latestReview = reviews.length > 0 
      ? new Date(Math.max(...reviews.map(r => r.createdAt.getTime())))
      : undefined;

    return {
      productId,
      averageRating,
      totalReviews: total,
      ratingDistribution,
      verifiedPurchases,
      reviewsWithImages,
      latestReview,
    };
  }

  async getUserReviews(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkUserReviewForProduct(userId: string, productId: string) {
    return this.prisma.review.findFirst({
      where: {
        userId,
        productId,
      },
    });
  }
}