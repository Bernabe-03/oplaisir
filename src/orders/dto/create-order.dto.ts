// src/orders/dto/create-order.dto.ts
import { 
  IsString, 
  IsEmail, 
  IsNumber, 
  IsArray, 
  IsOptional, 
  IsBoolean, 
  IsEnum, 
  ValidateNested, 
  Min, 
  Max 
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum DiscountType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage'
}

export class OrderItemDto {
  @IsEnum(['product', 'coffret', 'support'])
  type: 'product' | 'coffret' | 'support';

  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  metadata?: any;
}

export class DiscountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateOrderDto {
  @IsString()
  customerName: string;

  @IsString()
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsString()
  customerAddress: string;

  @IsString()
  customerCommune: string;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;

  @IsNumber()
  @Min(0)
  deliveryCost: number;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  total: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  requiresValidation?: boolean = true;
}