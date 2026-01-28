import { ProductStatus } from '@prisma/client';

export class ProductResponseDto {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  brand?: string;
  supplier?: string;
  purchasePrice: number;
  sellingPrice: number;
  tva: number;
  unit: string;
  weight?: number;
  weightUnit?: string;
  stock: number;
  minStock: number;
  maxStock: number;
  images: string[];
  
  // Nouveaux champs
  expirationDate?: Date;
  manufacturingDate?: Date;
  shelfLifeMonths?: number;
  batchNumber?: string;
  storageConditions?: string;
  
  // Champs système
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  
  // Créateur
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  
  // Propriétés calculées
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number;
  
  // Statistiques d'avis
  reviewStats?: {
    averageRating: number;
    totalReviews: number;
    rating: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    verifiedPurchases: number;
  };
}