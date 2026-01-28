export class Product {
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
  
  // Nouveaux champs pour le poids
  weight?: number;
  weightUnit?: string;
  
  stock: number;
  minStock: number;
  maxStock: number;
  images: string[];
  
  // Champs de date et gestion des lots
  expirationDate?: Date;
  manufacturingDate?: Date;
  shelfLifeMonths?: number;
  batchNumber?: string;
  storageConditions?: string;
  
  status: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  
  // Propriétés calculées
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number;
  
  // Relations
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