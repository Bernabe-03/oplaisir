import { IsOptional, IsNumber, IsEnum, IsString, Min, Max } from 'class-validator';
import { ReviewStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export enum ReviewSortBy {
  NEWEST = 'newest',
  HELPFUL = 'helpful',
  HIGHEST_RATING = 'highest_rating',
  LOWEST_RATING = 'lowest_rating'
}

export class ReviewQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsEnum(ReviewSortBy)
  sortBy?: ReviewSortBy = ReviewSortBy.NEWEST;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  verifiedOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  withImagesOnly?: boolean;
}