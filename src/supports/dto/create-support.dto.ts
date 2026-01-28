import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/* ===================== ENUMS ===================== */

export enum SupportType {
  BOITE = 'boite',
  PANIER = 'panier',
  COFFRET = 'coffret',
  SAC = 'sac',
  EMBALLAGE = 'emballage',
}

export enum SupportTheme {
  ANNIVERSAIRE = 'anniversaire',
  NAISSANCE = 'naissance',
  MARIAGE = 'mariage',
  FETES = 'fêtes',
  CORPORATE = 'corporate',
  ROMANTIQUE = 'romantique',
  DECOUVERTE = 'découverte',
}

export enum SupportMaterial {
  CARTON = 'carton',
  BOIS = 'bois',
  OSIER = 'osier',
  PLASTIQUE = 'plastique',
  CERAMIQUE = 'céramique',
}

export enum SupportStatus {
  ACTIF = 'actif',
  INACTIF = 'inactif',
  EPUISE = 'épuisé',
  MAINTENANCE = 'maintenance',
}

/* ===================== DTO ===================== */

export class CreateSupportDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty({ enum: SupportType, default: SupportType.BOITE })
  @IsEnum(SupportType)
  type: SupportType;

  @ApiProperty({ enum: SupportTheme, default: SupportTheme.ANNIVERSAIRE })
  @IsEnum(SupportTheme)
  theme: SupportTheme;

  @ApiProperty({ enum: SupportMaterial, default: SupportMaterial.CARTON })
  @IsEnum(SupportMaterial)
  material: SupportMaterial;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dimensions?: string;

  /* ✅ FIX ICI */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  compatibleThemes?: string[];

  @ApiProperty({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  capacity?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ required: false, default: 'g' })
  @IsOptional()
  @IsString()
  weightUnit?: string;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiProperty({ default: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tva?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiProperty({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiProperty({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ enum: SupportStatus, default: SupportStatus.ACTIF })
  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;

  /* ✅ FIX AUSSI ICI (édition) */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  existingImages?: string[];
}
