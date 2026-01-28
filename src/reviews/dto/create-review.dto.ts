import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsEmail, 
  IsPhoneNumber, 
  IsArray, 
  Min, 
  Max, 
  Length,
  IsBoolean,
  MinLength,
  MaxLength
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
  @IsString({ message: 'L\'ID du produit est requis' })
  @Transform(({ value }) => value?.trim())
  productId: string;

  @IsNumber({}, { message: 'La note doit être un nombre' })
  @Min(1, { message: 'La note minimale est 1' })
  @Max(5, { message: 'La note maximale est 5' })
  @Transform(({ value }) => {
    const num = parseInt(value);
    return isNaN(num) ? value : num;
  })
  rating: number;

  @IsString({ message: 'Le commentaire est requis' })
  @Length(10, 2000, { 
    message: 'Le commentaire doit contenir entre 10 et 2000 caractères' 
  })
  @Transform(({ value }) => value?.trim())
  comment: string;

  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  @MinLength(5, { 
    message: 'Le titre doit contenir au moins 5 caractères' 
  })
  @MaxLength(100, { 
    message: 'Le titre ne peut pas dépasser 100 caractères' 
  })
  @Transform(({ value }) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  title?: string;

  @IsString({ message: 'Le nom est requis' })
  @Length(2, 100, { 
    message: 'Le nom doit contenir entre 2 et 100 caractères' 
  })
  @Transform(({ value }) => value?.trim())
  customerName: string;

  @IsOptional()
  @IsEmail({}, { message: 'L\'email doit être valide' })
  @Transform(({ value }) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
  })
  customerEmail?: string;

  @IsOptional()
  @IsPhoneNumber('CI', { message: 'Le numéro de téléphone doit être valide pour la Côte d\'Ivoire' })
  @Transform(({ value }) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  customerPhone?: string;

  @IsOptional()
  @IsArray({ message: 'Les images doivent être un tableau' })
  @IsString({ each: true, message: 'Chaque image doit être une URL valide' })
  images?: string[];

  @IsOptional()
  @IsBoolean({ message: 'isVerifiedPurchase doit être un booléen' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isVerifiedPurchase?: boolean;

  @IsOptional()
  @IsString({ message: 'L\'ID utilisateur doit être une chaîne de caractères' })
  @Transform(({ value }) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  userId?: string;
}