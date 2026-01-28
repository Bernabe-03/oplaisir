import { 
    IsString, 
    IsNumber, 
    IsOptional, 
    IsEnum, 
    Min, 
    Max, 
    Length 
  } from 'class-validator';
  import { ReviewStatus } from '@prisma/client';
  import { PartialType } from '@nestjs/mapped-types';
  import { CreateReviewDto } from './create-review.dto';
  
  export class UpdateReviewDto extends PartialType(CreateReviewDto) {
    @IsOptional()
    @IsEnum(ReviewStatus)
    status?: ReviewStatus;
  
    @IsOptional()
    @IsNumber()
    @Min(0)
    helpfulCount?: number;
  }