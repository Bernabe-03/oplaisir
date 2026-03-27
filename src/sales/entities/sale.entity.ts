import { ApiProperty } from '@nestjs/swagger';

export class SaleEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  date: Date;

  @ApiProperty({ required: false })
  customerName?: string;

  @ApiProperty({ required: false })
  customerEmail?: string;

  @ApiProperty({ required: false })
  customerPhone?: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  discountType: string;

  @ApiProperty()
  tva: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  paymentMethod: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  sellerId?: string;
}