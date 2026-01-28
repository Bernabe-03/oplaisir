import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReviewsRepository } from './repositories/reviews.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { HelpfulReviewDto } from './dto/helpful-review.dto';
import { ReviewStatus } from '@prisma/client';
import { ProductReviewSummary, ReviewStats } from './interfaces/review-stats.interface';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private prisma: PrismaService
  ) {}

  async create(createReviewDto: CreateReviewDto) {
    // Vérifier si le produit existe
    const product = await this.prisma.product.findUnique({
      where: { id: createReviewDto.productId }
    });

    if (!product) {
      throw new BadRequestException('Produit non trouvé');
    }

    // MODIFICATION : Vérifier si l'utilisateur a déjà posté un avis PENDING ou APPROVED pour ce produit
    if (createReviewDto.userId) {
      const existingReview = await this.prisma.review.findFirst({
        where: {
          userId: createReviewDto.userId,
          productId: createReviewDto.productId,
          status: {
            in: [ReviewStatus.PENDING, ReviewStatus.APPROVED]
          }
        }
      });

      if (existingReview) {
        throw new BadRequestException('Vous avez déjà posté un avis pour ce produit');
      }
    }

    // MODIFICATION : Vérifier si l'email est déjà utilisé pour ce produit (seulement pour PENDING ou APPROVED)
    if (createReviewDto.customerEmail) {
      const emailReview = await this.prisma.review.findFirst({
        where: {
          customerEmail: createReviewDto.customerEmail,
          productId: createReviewDto.productId,
          status: {
            in: [ReviewStatus.PENDING, ReviewStatus.APPROVED]
          }
        }
      });

      if (emailReview) {
        throw new BadRequestException('Un avis avec cet email existe déjà pour ce produit');
      }
    }

    // MODIFICATION : Approuver automatiquement les avis au lieu de les mettre en PENDING
    return this.reviewsRepository.create({
      ...createReviewDto,
      status: ReviewStatus.APPROVED,  // MODIFICATION : APPROVED au lieu de PENDING
      publishedAt: new Date(),        // MODIFICATION : Date de publication immédiate
    });
  }

  async findAllByProduct(productId: string, query: ReviewQueryDto) {
    try {
      // Vérifier si le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        // Retourner une réponse vide si le produit n'existe pas
        return {
          reviews: [],
          meta: {
            total: 0,
            page: query.page || 1,
            limit: query.limit || 10,
            totalPages: 0
          }
        };
      }

      // Pour les utilisateurs non-admin, ne montrer que les avis approuvés
      if (!query.status) {
        query.status = ReviewStatus.APPROVED;
      }

      return this.reviewsRepository.findByProductId(productId, query);
    } catch (error) {
      // Retourner une réponse vide en cas d'erreur
      return {
        reviews: [],
        meta: {
          total: 0,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: 0
        }
      };
    }
  }

  async findOne(id: string) {
    const review = await this.reviewsRepository.findById(id);
    
    if (!review) {
      throw new NotFoundException(`Avis avec l'ID ${id} non trouvé`);
    }

    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto, userId?: string) {
    const review = await this.reviewsRepository.findById(id);
    
    if (!review) {
      throw new NotFoundException(`Avis avec l'ID ${id} non trouvé`);
    }

    // Vérifier les permissions
    if (userId && review.userId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cet avis');
    }

    // Les clients ne peuvent pas modifier le statut
    if (userId && updateReviewDto.status) {
      delete updateReviewDto.status;
    }

    return this.reviewsRepository.update(id, updateReviewDto);
  }

  async remove(id: string, userId?: string) {
    const review = await this.reviewsRepository.findById(id);
    
    if (!review) {
      throw new NotFoundException(`Avis avec l'ID ${id} non trouvé`);
    }

    // Vérifier les permissions
    if (userId && review.userId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer cet avis');
    }

    return this.reviewsRepository.delete(id);
  }

  async markAsHelpful(id: string, helpfulDto: HelpfulReviewDto) {
    if (helpfulDto.isHelpful) {
      return this.reviewsRepository.markAsHelpful(id);
    }
    return this.findOne(id);
  }

  async approveReview(id: string) {
    return this.reviewsRepository.updateStatus(id, ReviewStatus.APPROVED);
  }

  async rejectReview(id: string) {
    return this.reviewsRepository.updateStatus(id, ReviewStatus.REJECTED);
  }

  async getProductStats(productId: string): Promise<ReviewStats> {
    try {
      // Vérifier si le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        // Retourner des statistiques par défaut si le produit n'existe pas
        return {
          productId,
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          verifiedPurchases: 0,
          reviewsWithImages: 0
        };
      }

      // Récupérer les avis approuvés pour ce produit
      const reviews = await this.prisma.review.findMany({
        where: {
          productId,
          status: ReviewStatus.APPROVED,
        },
        select: {
          rating: true,
          isVerifiedPurchase: true,
          images: true,
        },
      });

      if (reviews.length === 0) {
        return {
          productId,
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          verifiedPurchases: 0,
          reviewsWithImages: 0
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
      const reviewsWithImages = reviews.filter(r => r.images && r.images.length > 0).length;

      return {
        productId,
        averageRating,
        totalReviews: total,
        ratingDistribution,
        verifiedPurchases,
        reviewsWithImages,
      };
    } catch (error) {
      // Retourner des statistiques par défaut en cas d'erreur
      return {
        productId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedPurchases: 0,
        reviewsWithImages: 0
      };
    }
  }

  async getUserReviews(userId: string, page: number = 1, limit: number = 10) {
    return this.reviewsRepository.getUserReviews(userId, page, limit);
  }

  async getRecentReviews(limit: number = 10) {
    try {
      return this.reviewsRepository.findByProductId('', {
        page: 1,
        limit,
        status: ReviewStatus.APPROVED,
        sortBy: 'newest' as any,
      });
    } catch (error) {
      return {
        reviews: [],
        meta: {
          total: 0,
          page: 1,
          limit,
          totalPages: 0
        }
      };
    }
  }

  async getProductReviewSummary(productId: string): Promise<ProductReviewSummary> {
    try {
      const stats = await this.getProductStats(productId);
      
      return {
        productId,
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
        rating: Math.round(stats.averageRating * 2) / 2,
      };
    } catch (error) {
      return {
        productId,
        averageRating: 0,
        totalReviews: 0,
        rating: 0,
      };
    }
  }

  async batchUpdateStatus(ids: string[], status: ReviewStatus) {
    try {
      const results = await Promise.all(
        ids.map(id => this.reviewsRepository.updateStatus(id, status))
      );
      return results;
    } catch (error) {
      return [];
    }
  }

  async getDashboardStats() {
    try {
      // Calculer les statistiques globales
      const totalReviews = await this.prisma.review.count();
      
      // MODIFICATION : Ne plus compter les avis PENDING car ils sont automatiquement approuvés
      const pendingReviews = 0; // Tous les avis sont automatiquement approuvés
      
      // Calculer la note moyenne globale
      const approvedReviews = await this.prisma.review.findMany({
        where: { status: ReviewStatus.APPROVED },
        select: { rating: true }
      });
      
      let averageRating = 0;
      if (approvedReviews.length > 0) {
        const sum = approvedReviews.reduce((acc, review) => acc + review.rating, 0);
        averageRating = parseFloat((sum / approvedReviews.length).toFixed(1));
      }

      // Récupérer les derniers avis
      const latestReviews = await this.prisma.review.findMany({
        where: { status: ReviewStatus.APPROVED },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true
            }
          }
        }
      });

      return {
        totalReviews,
        pendingReviews,
        averageRating,
        latestReviews,
      };
    } catch (error) {
      return {
        totalReviews: 0,
        pendingReviews: 0,
        averageRating: 0,
        latestReviews: [],
      };
    }
  }
}