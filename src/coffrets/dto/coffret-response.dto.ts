import { ApiProperty } from '@nestjs/swagger';
import type { Coffret, CoffretItem, Product, Support } from '@prisma/client';

export class CoffretItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  canReplace: boolean;

  @ApiProperty({ required: false })
  position?: number;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  product: Product;
}

export class CoffretResponseDto implements Partial<Coffret> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  type: string;

  @ApiProperty()
  theme: string;

  @ApiProperty({ required: false, nullable: true })
  supportId?: string | null;

  @ApiProperty({ type: [String] })
  images: string[];

  @ApiProperty({ required: false, nullable: true })
  rules?: any;

  @ApiProperty()
  stock: number;

  @ApiProperty({ required: false })
  minStock?: number;

  @ApiProperty({ required: false })
  maxStock?: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false, nullable: true })
  sku?: string | null;

  @ApiProperty({ required: false, nullable: true })
  margin?: number | null;

  @ApiProperty({ required: false, nullable: true })
  cost?: number | null;

  @ApiProperty({ required: false, nullable: true })
  userId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [CoffretItemResponseDto], required: false })
  items?: CoffretItemResponseDto[];

  @ApiProperty({ required: false, nullable: true })
  support?: Support | null;
}