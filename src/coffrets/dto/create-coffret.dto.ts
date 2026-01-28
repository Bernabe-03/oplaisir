import { 
    IsString, 
    IsNumber, 
    IsOptional, 
    IsArray, 
    IsBoolean, 
    IsObject, 
    Min, 
    Max, 
    IsInt, 
    IsEnum,
    ValidateNested 
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { ApiProperty } from '@nestjs/swagger';
  
  export class CoffretProductDto {
    @ApiProperty()
    @IsString()
    productId: string;
  
    @ApiProperty({ default: 1 })
    @IsNumber()
    @IsInt()
    @Min(1)
    quantity: number;
  
    @ApiProperty({ default: true })
    @IsOptional()
    @IsBoolean()
    canReplace?: boolean;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    position?: number;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
  }
  
  export class CreateCoffretDto {
    @ApiProperty()
    @IsString()
    name: string;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;
  
    @ApiProperty({ default: 0 })
    @IsNumber()
    @Min(0)
    price: number;
  
    @ApiProperty({ default: 'moyen' })
    @IsOptional()
    @IsString()
    type?: string;
  
    @ApiProperty({ default: 'anniversaire' })
    @IsOptional()
    @IsString()
    theme?: string;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supportId?: string;
  
    @ApiProperty({ type: [CoffretProductDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CoffretProductDto)
    products?: CoffretProductDto[];
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    rules?: any;
  
    @ApiProperty({ default: 0 })
    @IsOptional()
    @IsNumber()
    @IsInt()
    @Min(0)
    stock?: number;
  
    @ApiProperty({ default: 5 })
    @IsOptional()
    @IsNumber()
    @IsInt()
    @Min(0)
    minStock?: number;
  
    @ApiProperty({ default: 50 })
    @IsOptional()
    @IsNumber()
    @IsInt()
    @Min(0)
    maxStock?: number;
  
    @ApiProperty({ default: 'ACTIF' })
    @IsOptional()
    @IsString()
    status?: string;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    sku?: string;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    margin?: number;
  
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    cost?: number;
  }