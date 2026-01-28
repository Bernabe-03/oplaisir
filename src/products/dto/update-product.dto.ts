import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  existingImages?: string[];

  @IsString()
  @IsOptional()
  userId?: string;
}