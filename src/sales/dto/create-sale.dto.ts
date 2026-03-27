import { IsArray, IsNumber, IsString, IsOptional, IsEnum, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SaleItemDto {
  @IsEnum(['product', 'coffret', 'support'])
  type: string;

  @IsString()
  id: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

class CustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsNumber()
  @Min(0)
  discount: number = 0;

  @IsEnum(['fixed', 'percentage'])
  discountType: string = 'fixed';

  @IsEnum(['espèces', 'carte bancaire', 'mobile money', 'chèque'])
  paymentMethod: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto;

  @IsOptional()
  @IsString()
  sellerId?: string; // à remplacer par l'utilisateur connecté
}