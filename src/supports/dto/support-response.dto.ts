import { ApiProperty } from '@nestjs/swagger';
import { SupportType, SupportTheme, SupportMaterial } from './create-support.dto';

export class SupportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ enum: SupportType })
  type: SupportType;

  @ApiProperty({ enum: SupportTheme })
  theme: SupportTheme;

  @ApiProperty({ enum: SupportMaterial })
  material: SupportMaterial;

  @ApiProperty({ required: false })
  color?: string;

  @ApiProperty({ required: false })
  dimensions?: string;

  @ApiProperty({ type: [String] })
  compatibleThemes: string[];

  @ApiProperty()
  capacity: number;

  @ApiProperty({ required: false })
  weight?: number;

  @ApiProperty({ required: false })
  weightUnit?: string;

  @ApiProperty()
  purchasePrice: number;

  @ApiProperty()
  sellingPrice: number;

  @ApiProperty()
  tva: number;

  @ApiProperty()
  stock: number;

  @ApiProperty()
  minStock: number;

  @ApiProperty()
  maxStock: number;

  @ApiProperty({ type: [String] })
  images: string[];

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  userId?: string;
}
