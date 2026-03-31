import { 
  IsEnum, 
  IsOptional, 
  IsString, 
  IsNotEmpty,
  IsNumber,
  Min
} from 'class-validator';
import { Transform } from 'class-transformer';

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
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  reason?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  notes?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  estimatedDelivery?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value === '' || value === null) ? undefined : Number(value))
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  deliveryPerson?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  trackingNumber?: string;
}