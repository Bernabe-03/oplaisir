// src/orders/dto/validate-order.dto.ts
import { 
    IsEnum, 
    IsOptional, 
    IsString, 
    IsDateString,
    IsNotEmpty,
    IsNumber,
    Min
  } from 'class-validator';
  
  export enum ValidationAction {
    VALIDATE = 'validate',
    REJECT = 'reject',
    COMPLETE = 'complete',
    CANCEL = 'cancel',
    SHIP = 'ship',
    DELIVER = 'deliver'
  }
  
  export class ValidateOrderDto {
    @IsEnum(ValidationAction)
    @IsNotEmpty()
    action: ValidationAction;
  
    @IsOptional()
    @IsString()
    reason?: string;
  
    @IsOptional()
    @IsDateString()
    deliveryDate?: Date;
  
    @IsOptional()
    @IsDateString()
    estimatedDelivery?: Date;
  
    @IsOptional()
    @IsNumber()
    @Min(0)
    paidAmount?: number;
  
    @IsOptional()
    @IsString()
    paymentReference?: string;
  
    @IsOptional()
    @IsString()
    deliveryPerson?: string;
  
    @IsOptional()
    @IsString()
    trackingNumber?: string;
  }