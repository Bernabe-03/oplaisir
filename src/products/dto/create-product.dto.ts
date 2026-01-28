import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsNumber()
  @Type(() => Number)
  purchasePrice: number;

  @IsNumber()
  @Type(() => Number)
  sellingPrice: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tva?: number = 18;

  @IsString()
  @IsOptional()
  unit?: string = 'pièce';

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  weight?: number = 0;

  @IsString()
  @IsOptional()
  weightUnit?: string = 'g';

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stock?: number = 0;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  minStock?: number = 10;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  maxStock?: number = 100;

  // Nouveaux champs
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  shelfLifeMonths?: number = 0;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsOptional()
  storageConditions?: string = 'température ambiante';

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus = ProductStatus.ACTIF;

  @IsString()
  @IsOptional()
  userId?: string;
}