import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SalesRepository } from './repositories/sales.repository';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ReturnDto } from './dto/return.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { Prisma, Sale, SaleItem } from '@prisma/client';

type SaleWithItems = Sale & {
  items: (SaleItem & {
    product?: any;
    coffret?: any;
    support?: any;
  })[];
  seller?: any;
};

@Injectable()
export class SalesService {
  constructor(private readonly salesRepository: SalesRepository) {}

  async create(createSaleDto: CreateSaleDto): Promise<SaleResponseDto> {
    const totals = this.calculateTransactionTotals(
      createSaleDto.items,
      createSaleDto.discount,
      createSaleDto.discountType,
    );

    const transactionId = `TRX-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substr(2, 4)}`;

    const data: Prisma.SaleCreateInput = {
      transactionId,
      date: new Date(),
      customerName: createSaleDto.customer?.name,
      customerEmail: createSaleDto.customer?.email,
      customerPhone: createSaleDto.customer?.phone,
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountType: createSaleDto.discountType,
      tva: totals.tva,
      total: totals.total,
      paymentMethod: createSaleDto.paymentMethod,
      status: 'COMPLETED',
      items: {
        create: createSaleDto.items.map(item => ({
          type: item.type.toUpperCase(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.type === 'product' && { productId: item.id }),
          ...(item.type === 'coffret' && { coffretId: item.id }),
          ...(item.type === 'support' && { supportId: item.id }),
        })),
      },
    };

    if (createSaleDto.sellerId) {
      data.seller = { connect: { id: createSaleDto.sellerId } };
    }

    const sale = await this.salesRepository.create(data);
    await this.updateStockAfterSale(createSaleDto.items);
    return this.mapToResponseDto(sale);
  }

  async findAll(filters: {
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: string;
  }): Promise<SaleResponseDto[]> {
    const where: Prisma.SaleWhereInput = {};

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
    if (filters.status) where.status = filters.status;

    const sales = await this.salesRepository.findAll(where);
    return sales.map(sale => this.mapToResponseDto(sale));
  }

  async findOne(id: string): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException(`Vente avec l'id ${id} non trouvée`);
    return this.mapToResponseDto(sale);
  }

  async update(id: string, updateSaleDto: UpdateSaleDto): Promise<SaleResponseDto> {
    const existing = await this.salesRepository.findById(id);
    if (!existing) throw new NotFoundException(`Vente avec l'id ${id} non trouvée`);

    let newTotals: { subtotal: number; discount: number; tva: number; total: number } | undefined;
    if (updateSaleDto.items || updateSaleDto.discount !== undefined || updateSaleDto.discountType) {
      const items = updateSaleDto.items || existing.items.map(i => ({
        type: i.type.toLowerCase(),
        id: i.productId || i.coffretId || i.supportId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
      const discount = updateSaleDto.discount ?? existing.discount;
      const discountType = updateSaleDto.discountType ?? existing.discountType;
      newTotals = this.calculateTransactionTotals(items, discount, discountType);
    }

    const updateData: Prisma.SaleUpdateInput = {};

    if (updateSaleDto.customer) {
      if (updateSaleDto.customer.name !== undefined) updateData.customerName = updateSaleDto.customer.name;
      if (updateSaleDto.customer.email !== undefined) updateData.customerEmail = updateSaleDto.customer.email;
      if (updateSaleDto.customer.phone !== undefined) updateData.customerPhone = updateSaleDto.customer.phone;
    }

    if (updateSaleDto.paymentMethod) updateData.paymentMethod = updateSaleDto.paymentMethod;
    if (updateSaleDto.status) updateData.status = updateSaleDto.status;

    if (newTotals) {
      updateData.subtotal = newTotals.subtotal;
      updateData.discount = newTotals.discount;
      updateData.discountType = updateSaleDto.discountType ?? existing.discountType;
      updateData.tva = newTotals.tva;
      updateData.total = newTotals.total;
    }

    if (updateSaleDto.items) {
      await this.salesRepository.updateWithItems(id, updateData, updateSaleDto.items);
    } else {
      await this.salesRepository.update(id, updateData);
    }

    const updated = await this.salesRepository.findById(id);
    if (!updated) throw new NotFoundException('Vente non trouvée après mise à jour');
    return this.mapToResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.salesRepository.findById(id);
    if (!existing) throw new NotFoundException(`Vente avec l'id ${id} non trouvée`);
    await this.salesRepository.delete(id);
  }

  // ------------------- Statistiques -------------------

  async getSalesTrend(days: number = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sales = await this.salesRepository.findAll({ date: { gte: startDate, lte: endDate } });

    const trend: { date: string; label: string; revenue: number; transactions: number }[] = [];
    const map = new Map<string, { revenue: number; transactions: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      map.set(d.toISOString().split('T')[0], { revenue: 0, transactions: 0 });
    }

    sales.forEach(sale => {
      const key = new Date(sale.date).toISOString().split('T')[0];
      const entry = map.get(key);
      if (entry) {
        entry.revenue += sale.total;
        entry.transactions += 1;
      }
    });

    map.forEach((value, key) => {
      trend.push({
        date: key,
        label: new Date(key).toLocaleDateString('fr-CI', { day: 'numeric', month: 'short' }),
        revenue: value.revenue,
        transactions: value.transactions,
      });
    });

    return trend;
  }

  async getTopProducts(limit: number = 10, period: string = 'month'): Promise<any[]> {
    const { startDate } = this.getPeriodDates(period);
    const sales = await this.salesRepository.findAllWithItems({ date: { gte: startDate } });

    const productMap = new Map<string, { quantity: number; revenue: number; name: string }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.type === 'PRODUCT' && item.product) {
          const id = item.productId!;
          const current = productMap.get(id) || { quantity: 0, revenue: 0, name: item.product.name };
          current.quantity += item.quantity;
          current.revenue += item.unitPrice * item.quantity;
          productMap.set(id, current);
        }
      }
    }

    const top = Array.from(productMap.entries()).map(([id, data]) => ({ id, ...data }));
    top.sort((a, b) => b.revenue - a.revenue);
    return top.slice(0, limit);
  }

  async getTopCoffrets(limit: number = 10, period: string = 'month'): Promise<any[]> {
    const { startDate } = this.getPeriodDates(period);
    const sales = await this.salesRepository.findAllWithItems({ date: { gte: startDate } });

    const coffretMap = new Map<string, { quantity: number; revenue: number; name: string }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.type === 'COFFRET' && item.coffret) {
          const id = item.coffretId!;
          const current = coffretMap.get(id) || { quantity: 0, revenue: 0, name: item.coffret.name };
          current.quantity += item.quantity;
          current.revenue += item.unitPrice * item.quantity;
          coffretMap.set(id, current);
        }
      }
    }

    const top = Array.from(coffretMap.entries()).map(([id, data]) => ({ id, ...data }));
    top.sort((a, b) => b.revenue - a.revenue);
    return top.slice(0, limit);
  }

  async getTopSupports(limit: number = 10, period: string = 'month'): Promise<any[]> {
    const { startDate } = this.getPeriodDates(period);
    const sales = await this.salesRepository.findAllWithItems({ date: { gte: startDate } });

    const supportMap = new Map<string, { quantity: number; revenue: number; name: string }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.type === 'SUPPORT' && item.support) {
          const id = item.supportId!;
          const current = supportMap.get(id) || { quantity: 0, revenue: 0, name: item.support.name };
          current.quantity += item.quantity;
          current.revenue += item.unitPrice * item.quantity;
          supportMap.set(id, current);
        }
      }
    }

    const top = Array.from(supportMap.entries()).map(([id, data]) => ({ id, ...data }));
    top.sort((a, b) => b.revenue - a.revenue);
    return top.slice(0, limit);
  }

  async calculateAverageCart(period: string = 'month'): Promise<number> {
    const { startDate } = this.getPeriodDates(period);
    const sales = await this.salesRepository.findAll({ date: { gte: startDate } });
    if (sales.length === 0) return 0;
    const total = sales.reduce((sum, s) => sum + s.total, 0);
    return total / sales.length;
  }

  async getRevenueByPaymentMethod(period: string = 'month'): Promise<Record<string, number>> {
    const { startDate } = this.getPeriodDates(period);
    const sales = await this.salesRepository.findAll({ date: { gte: startDate } });
    const result: Record<string, number> = {};
    sales.forEach(s => {
      const method = s.paymentMethod || 'AUTRE';
      result[method] = (result[method] || 0) + s.total;
    });
    return result;
  }

  async getCustomerStats(period: string = 'month'): Promise<any> {
    const { startDate } = this.getPeriodDates(period === 'all' ? undefined : period);
    const where = startDate ? { date: { gte: startDate } } : {};
    const sales = await this.salesRepository.findAllWithCustomer(where);

    const customersMap = new Map<string, {
      email: string;
      name: string;
      phone: string;
      totalSpent: number;
      orders: number;
      lastPurchase: Date;
    }>();

    sales.forEach(sale => {
      const email = sale.customerEmail || 'inconnu';
      if (!customersMap.has(email)) {
        customersMap.set(email, {
          email,
          name: sale.customerName || 'Inconnu',
          phone: sale.customerPhone || '',
          totalSpent: 0,
          orders: 0,
          lastPurchase: sale.date,
        });
      }
      const cust = customersMap.get(email)!;
      cust.totalSpent += sale.total;
      cust.orders += 1;
      if (sale.date > cust.lastPurchase) cust.lastPurchase = sale.date;
    });

    const customers = Array.from(customersMap.values());
    const totalCustomers = customers.length;
    const loyalCustomers = customers.filter(c => c.orders >= 3).length;
    const newCustomers = customers.filter(c => {
      const firstSale = sales.find(s => s.customerEmail === c.email);
      return firstSale && firstSale.date >= startDate!;
    }).length;
    const inactiveCustomers = customers.filter(c => {
      const daysSinceLast = (new Date().getTime() - new Date(c.lastPurchase).getTime()) / (1000 * 3600 * 24);
      return daysSinceLast > 90;
    }).length;

    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageCustomerValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0;
    const topCustomers = customers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

    return {
      topCustomers,
      topSellers: [],
      averageCustomerValue,
      loyalCustomers,
      newCustomers,
      inactiveCustomers,
      totalCustomers,
    };
  }

  // ------------------- Retours -------------------

  async getReturns(): Promise<any[]> {
    return [];
  }

  async processReturn(returnDto: ReturnDto): Promise<any> {
    const sale = await this.salesRepository.findById(returnDto.saleId);
    if (!sale) throw new NotFoundException('Vente non trouvée');

    for (const ret of returnDto.items) {
      const originalItem = sale.items.find(
        item => (item.productId === ret.productId || item.coffretId === ret.productId) && item.type === ret.type.toUpperCase(),
      );
      if (!originalItem || ret.quantity > originalItem.quantity) {
        throw new BadRequestException(`Quantité invalide pour l'article ${ret.productId}`);
      }
    }

    let returnAmount = 0;
    const returnDetails: any[] = []; // Typage explicite pour éviter l'erreur TS

    for (const ret of returnDto.items) {
      const originalItem = sale.items.find(
        item => (item.productId === ret.productId || item.coffretId === ret.productId) && item.type === ret.type.toUpperCase(),
      )!;
      const itemReturnAmount = originalItem.unitPrice * ret.quantity;
      returnAmount += itemReturnAmount;
      returnDetails.push({
        ...ret,
        unitPrice: originalItem.unitPrice,
        returnAmount: itemReturnAmount,
      });
    }

    const returnRecord = {
      returnId: `RET-${Date.now()}`,
      originalTransactionId: sale.transactionId,
      date: new Date(),
      reason: returnDto.reason,
      items: returnDetails,
      totals: { returnAmount, total: returnAmount },
      status: 'processed',
    };

    await this.increaseStockAfterReturn(returnDto.items);
    return returnRecord;
  }

  // ------------------- Rapports -------------------

  async generateSalesReport(startDate: Date, endDate: Date, groupBy: string = 'day'): Promise<any> {
    const sales = await this.salesRepository.findAllWithItems({ date: { gte: startDate, lte: endDate } });

    const report: any = {
      period: { start: startDate, end: endDate },
      summary: { totalSales: 0, totalTransactions: 0, averageCart: 0, totalItemsSold: 0 },
      dailyData: {},
      productPerformance: {},
      paymentMethods: {},
    };

    sales.forEach(sale => {
      const d = new Date(sale.date);
      let periodKey: string;
      switch (groupBy) {
        case 'hour': periodKey = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}h`; break;
        case 'day': periodKey = `${d.getDate()}/${d.getMonth()+1}`; break;
        case 'week': periodKey = `Semaine ${Math.ceil(d.getDate()/7)}`; break;
        case 'month': periodKey = d.toLocaleString('fr-CI', { month: 'long' }); break;
        default: periodKey = d.toDateString();
      }

      if (!report.dailyData[periodKey]) {
        report.dailyData[periodKey] = { date: periodKey, sales: 0, transactions: 0, items: 0 };
      }

      report.summary.totalSales += sale.total;
      report.summary.totalTransactions += 1;
      const itemsCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
      report.summary.totalItemsSold += itemsCount;
      report.dailyData[periodKey].sales += sale.total;
      report.dailyData[periodKey].transactions += 1;
      report.dailyData[periodKey].items += itemsCount;

      sale.items.forEach(item => {
        const key = item.productId || item.coffretId || item.supportId;
        if (!key) return;
        if (!report.productPerformance[key]) {
          report.productPerformance[key] = {
            name: item.product?.name || item.coffret?.name || item.support?.name || 'Inconnu',
            quantity: 0,
            revenue: 0,
          };
        }
        report.productPerformance[key].quantity += item.quantity;
        report.productPerformance[key].revenue += item.unitPrice * item.quantity;
      });

      const method = sale.paymentMethod || 'AUTRE';
      report.paymentMethods[method] = (report.paymentMethods[method] || 0) + sale.total;
    });

    report.summary.averageCart = report.summary.totalTransactions > 0
      ? report.summary.totalSales / report.summary.totalTransactions
      : 0;

    report.dailyData = Object.values(report.dailyData);
    report.productPerformance = Object.values(report.productPerformance).sort((a: any, b: any) => b.revenue - a.revenue);
    report.paymentMethods = Object.entries(report.paymentMethods)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a: any, b: any) => b.amount - a.amount);

    return report;
  }

  async exportSalesData(format: string = 'json'): Promise<any> {
    const sales = await this.salesRepository.findAllWithItems({});

    const exportData = sales.map(sale => ({
      transactionId: sale.transactionId,
      date: sale.date,
      seller: (sale as any).seller?.name,
      items: sale.items.map(item => ({
        type: item.type,
        id: item.productId || item.coffretId || item.supportId,
        name: item.product?.name || item.coffret?.name || item.support?.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.quantity,
      })),
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        tva: sale.tva,
        total: sale.total,
      },
      paymentMethod: sale.paymentMethod,
      status: sale.status,
    }));

    if (format === 'csv') {
      const headers = ['Transaction ID', 'Date', 'Seller', 'Total', 'Payment Method', 'Status'];
      const rows = exportData.map(s => [
        s.transactionId,
        s.date.toISOString(),
        s.seller || '',
        s.totals.total,
        s.paymentMethod,
        s.status,
      ]);
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return exportData;
  }

  // ------------------- Méthodes privées -------------------

  private calculateTransactionTotals(
    items: { unitPrice: number; quantity: number }[],
    discount: number = 0,
    discountType: string = 'fixed',
  ): { subtotal: number; discount: number; tva: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount = discountType === 'percentage' ? subtotal * (discount / 100) : discount;
    const afterDiscount = subtotal - discountAmount;
    const tva = afterDiscount * 0.18;
    const total = afterDiscount + tva;
    return { subtotal, discount: discountAmount, tva, total };
  }

  private getPeriodDates(period?: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case 'today': startDate.setHours(0,0,0,0); break;
      case 'week': startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0,0,0,0); break;
      case 'month': startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); break;
      case 'year': startDate = new Date(endDate.getFullYear(), 0, 1); break;
      default: startDate = new Date(0); break;
    }
    return { startDate, endDate };
  }

  private async updateStockAfterSale(items: any[]): Promise<void> {}
  private async increaseStockAfterReturn(items: any[]): Promise<void> {}

  private mapToResponseDto(sale: Sale & { items?: SaleItem[]; seller?: any }): SaleResponseDto {
    return {
      id: sale.id,
      transactionId: sale.transactionId,
      date: sale.date,
      customer: {
        name: sale.customerName ?? undefined,
        email: sale.customerEmail ?? undefined,
        phone: sale.customerPhone ?? undefined,
      },
      items: sale.items?.map(item => ({
        type: item.type.toLowerCase(),
        id: item.productId || item.coffretId || item.supportId || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || [],
      discount: sale.discount,
      discountType: sale.discountType,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        tva: sale.tva,
        total: sale.total,
      },
      paymentMethod: sale.paymentMethod,
      seller: sale.seller?.name,
      status: sale.status,
    };
  }
}