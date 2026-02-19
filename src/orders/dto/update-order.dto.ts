// src/orders/dto/update-order.dto.ts
import { 
    IsEnum, 
    IsOptional, 
    IsString, 
    IsDateString,
    IsNumber 
  } from 'class-validator';
  
  export enum OrderStatus {
    PENDING = 'PENDING',
    VALIDATED = 'VALIDATED',
    REJECTED = 'REJECTED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    DELIVERED = 'DELIVERED'
  }
  
  export enum PaymentStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    PARTIALLY_PAID = 'PARTIALLY_PAID',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED'
  }
  
  export class UpdateOrderDto {
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;
  
    @IsOptional()
    @IsEnum(PaymentStatus)
    paymentStatus?: PaymentStatus;
  
    @IsOptional()
    @IsDateString()
    deliveryDate?: Date;
  
    @IsOptional()
    @IsString()
    notes?: string;
  
    @IsOptional()
    @IsNumber()
    discountAmount?: number;
  
    @IsOptional()
    @IsString()
    discountType?: string;
  
    @IsOptional()
    @IsNumber()
    deliveryCost?: number;
  }