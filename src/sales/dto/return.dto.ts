import { IsString, IsArray, IsNumber, Min, IsEnum } from 'class-validator';

class ReturnItemDto {
  @IsEnum(['product', 'coffret', 'support'])
  type: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ReturnDto {
  @IsString()
  saleId: string;

  @IsArray()
  items: ReturnItemDto[];

  @IsString()
  reason: string;
}