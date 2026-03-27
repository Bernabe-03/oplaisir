import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service'; // Chemin corrigé
import { Prisma, Sale, SaleItem } from '@prisma/client';

@Injectable()
export class SalesRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.SaleCreateInput): Promise<Sale> {
    return this.prisma.sale.create({ data });
  }

  async findAll(where?: Prisma.SaleWhereInput): Promise<Sale[]> {
    return this.prisma.sale.findMany({ where, orderBy: { date: 'desc' } });
  }

  async findAllWithItems(where?: Prisma.SaleWhereInput): Promise<(Sale & { items: (SaleItem & { product?: any; coffret?: any; support?: any })[] })[]> {
    return this.prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true, coffret: true, support: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findAllWithCustomer(where?: Prisma.SaleWhereInput): Promise<Sale[]> {
    return this.prisma.sale.findMany({ where, include: { seller: true } });
  }

  async findById(id: string): Promise<(Sale & { items: SaleItem[]; seller?: any }) | null> {
    return this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, seller: true },
    });
  }

  async update(id: string, data: Prisma.SaleUpdateInput): Promise<Sale> {
    return this.prisma.sale.update({ where: { id }, data });
  }

  async updateWithItems(id: string, data: Prisma.SaleUpdateInput, items: any[]): Promise<Sale> {
    return this.prisma.$transaction(async (prisma) => {
      await prisma.saleItem.deleteMany({ where: { saleId: id } });
      const updated = await prisma.sale.update({
        where: { id },
        data: {
          ...data,
          items: {
            create: items.map(item => ({
              type: item.type.toUpperCase(),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              ...(item.type === 'product' && { productId: item.id }),
              ...(item.type === 'coffret' && { coffretId: item.id }),
              ...(item.type === 'support' && { supportId: item.id }),
            })),
          },
        },
      });
      return updated;
    });
  }

  async delete(id: string): Promise<Sale> {
    return this.prisma.sale.delete({ where: { id } });
  }
}