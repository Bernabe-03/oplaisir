export class SaleResponseDto {
    id: string;
    transactionId: string;
    date: Date;
    customer: {
      name?: string;
      email?: string;
      phone?: string;
    };
    items: {
      type: string;
      id: string;
      quantity: number;
      unitPrice: number;
    }[];
    discount: number;
    discountType: string;
    totals: {
      subtotal: number;
      discount: number;
      tva: number;
      total: number;
    };
    paymentMethod: string;
    seller?: string;
    status: string;
  }