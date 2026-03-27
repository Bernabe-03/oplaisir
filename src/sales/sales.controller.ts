import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
  } from '@nestjs/common';
  import { SalesService } from './sales.service';
  import { CreateSaleDto } from './dto/create-sale.dto';
  import { UpdateSaleDto } from './dto/update-sale.dto';
  import { ReturnDto } from './dto/return.dto';
  import { SaleResponseDto } from './dto/sale-response.dto';
  import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
  
  @ApiTags('ventes')
  @Controller('sales')
  export class SalesController {
    constructor(private readonly salesService: SalesService) {}
  
    @Post()
    @ApiOperation({ summary: 'Créer une nouvelle vente' })
    @ApiResponse({ status: 201, description: 'Vente créée', type: SaleResponseDto })
    async create(@Body() createSaleDto: CreateSaleDto): Promise<SaleResponseDto> {
      return this.salesService.create(createSaleDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Lister toutes les ventes avec filtres optionnels' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'paymentMethod', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiResponse({ status: 200, type: [SaleResponseDto] })
    async findAll(
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string,
      @Query('paymentMethod') paymentMethod?: string,
      @Query('status') status?: string,
    ): Promise<SaleResponseDto[]> {
      return this.salesService.findAll({ startDate, endDate, paymentMethod, status });
    }
  
    @Get('trend')
    @ApiOperation({ summary: 'Tendance des ventes sur une période' })
    @ApiQuery({ name: 'days', required: false, example: 30 })
    async getTrend(@Query('days') days: number = 30) {
      return this.salesService.getSalesTrend(days);
    }
  
    @Get('top-products')
    @ApiOperation({ summary: 'Produits les plus vendus' })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
    async getTopProducts(
      @Query('limit') limit: number = 10,
      @Query('period') period: string = 'month',
    ) {
      return this.salesService.getTopProducts(limit, period);
    }
  
    @Get('top-coffrets')
    @ApiOperation({ summary: 'Coffrets les plus vendus' })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
    async getTopCoffrets(
      @Query('limit') limit: number = 10,
      @Query('period') period: string = 'month',
    ) {
      return this.salesService.getTopCoffrets(limit, period);
    }
  
    @Get('top-supports')
    @ApiOperation({ summary: 'Supports les plus vendus' })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
    async getTopSupports(
      @Query('limit') limit: number = 10,
      @Query('period') period: string = 'month',
    ) {
      return this.salesService.getTopSupports(limit, period);
    }
  
    @Get('average-cart')
    @ApiOperation({ summary: 'Panier moyen sur une période' })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
    async getAverageCart(@Query('period') period: string = 'month') {
      return this.salesService.calculateAverageCart(period);
    }
  
    @Get('revenue-by-method')
    @ApiOperation({ summary: 'Répartition du chiffre d\'affaires par mode de paiement' })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year'] })
    async getRevenueByPaymentMethod(@Query('period') period: string = 'month') {
      return this.salesService.getRevenueByPaymentMethod(period);
    }
  
    @Get('customer-stats')
    @ApiOperation({ summary: 'Statistiques clients' })
    @ApiQuery({ name: 'period', required: false, enum: ['today', 'week', 'month', 'year', 'all'] })
    async getCustomerStats(@Query('period') period: string = 'month') {
      return this.salesService.getCustomerStats(period);
    }
  
    @Get('returns')
    @ApiOperation({ summary: 'Lister tous les retours' })
    async getReturns() {
      return this.salesService.getReturns();
    }
  
    @Post('returns')
    @ApiOperation({ summary: 'Créer un retour' })
    async createReturn(@Body() returnDto: ReturnDto) {
      return this.salesService.processReturn(returnDto);
    }
  
    @Get('report')
    @ApiOperation({ summary: 'Générer un rapport de ventes' })
    @ApiQuery({ name: 'startDate', required: true })
    @ApiQuery({ name: 'endDate', required: true })
    @ApiQuery({ name: 'groupBy', required: false, enum: ['hour', 'day', 'week', 'month'] })
    async generateReport(
      @Query('startDate') startDate: string,
      @Query('endDate') endDate: string,
      @Query('groupBy') groupBy: string = 'day',
    ) {
      return this.salesService.generateSalesReport(
        new Date(startDate),
        new Date(endDate),
        groupBy,
      );
    }
  
    @Get('export')
    @ApiOperation({ summary: 'Exporter les ventes au format CSV ou JSON' })
    @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
    async exportSales(@Query('format') format: string = 'json') {
      return this.salesService.exportSalesData(format);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Obtenir une vente par ID' })
    async findOne(@Param('id') id: string): Promise<SaleResponseDto> {
      return this.salesService.findOne(id);
    }
  
    @Put(':id')
    @ApiOperation({ summary: 'Mettre à jour une vente' })
    async update(
      @Param('id') id: string,
      @Body() updateSaleDto: UpdateSaleDto,
    ): Promise<SaleResponseDto> {
      return this.salesService.update(id, updateSaleDto);
    }
  
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Supprimer une vente' })
    async remove(@Param('id') id: string): Promise<void> {
      return this.salesService.remove(id);
    }
  }