// src/orders/orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  Logger,
  UseInterceptors,
  ClassSerializerInterceptor
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ValidateOrderDto } from './dto/validate-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('orders')
@UseInterceptors(ClassSerializerInterceptor)
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 500, description: 'Erreur serveur' })
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    try {
      this.logger.log('📦 Création d\'une nouvelle commande', {
        customerName: createOrderDto.customerName,
        itemsCount: createOrderDto.items?.length || 0,
        total: createOrderDto.total,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // Log détaillé des items pour débogage
      this.logger.debug('📋 Détail des items:', {
        items: createOrderDto.items?.map(item => ({
          type: item.type,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });

      const userId = req.user?.id;
      const order = await this.ordersService.createOrder(createOrderDto, userId);

      this.logger.log('✅ Commande créée avec succès', {
        orderNumber: order.orderNumber,
        orderId: order.id,
        total: order.total,
        status: order.status
      });

      return {
        success: true,
        message: 'Commande créée avec succès',
        data: order,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur création commande:', error.message, error.stack);
      
      // Vérifier si c'est une erreur de validation de type support
      if (error.message.includes('Support') || error.message.includes('support')) {
        this.logger.warn('⚠️ Erreur liée à un support, tentative de normalisation...');
        
        // Réessayer avec une normalisation forcée
        try {
          // Cloner le DTO pour éviter la mutation
          const normalizedDto = { ...createOrderDto };
          
          // Forcer la normalisation des supports
          normalizedDto.items = normalizedDto.items.map(item => {
            // Si le SKU commence par SUP- ou le nom contient 'support', forcer le type
            if (item.sku?.startsWith('SUP-') || item.name?.toLowerCase().includes('support')) {
              return { ...item, type: 'support' as any };
            }
            return item;
          });

          const userId = req.user?.id;
          const order = await this.ordersService.createOrder(normalizedDto, userId);
          
          this.logger.log('✅ Commande créée après correction des supports');
          
          return {
            success: true,
            message: 'Commande créée avec succès après correction automatique',
            data: order,
            timestamp: new Date().toISOString()
          };
        } catch (retryError) {
          this.logger.error('❌ Échec de la création après correction:', retryError.message);
          throw new HttpException(
            {
              success: false,
              message: `Impossible de créer la commande après tentative de correction: ${retryError.message}`,
              error: 'ORDER_CREATION_FAILED',
              timestamp: new Date().toISOString()
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'Erreur lors de la création de la commande',
          error: 'ORDER_CREATION_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir la liste des commandes' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page' })
  @ApiResponse({ status: 200, description: 'Liste des commandes' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req
  ) {
    try {
      this.logger.log('📋 Récupération des commandes', {
        status,
        page,
        limit,
        userId: req.user?.id,
        role: req.user?.role
      });

      const result = await this.ordersService.getOrders(
        status,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );

      this.logger.log(`✅ ${result.orders.length} commandes récupérées`);

      return {
        success: true,
        data: result.orders,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération commandes:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des commandes',
          error: 'ORDERS_FETCH_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les commandes en attente' })
  @ApiResponse({ status: 200, description: 'Commandes en attente' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findPending(@Request() req) {
    try {
      this.logger.log('⏳ Récupération des commandes en attente', {
        userId: req.user?.id
      });

      const pendingOrders = await this.ordersService.getPendingOrders();

      this.logger.log(`✅ ${pendingOrders.length} commandes en attente trouvées`);

      return {
        success: true,
        data: pendingOrders,
        count: pendingOrders.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération commandes en attente:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des commandes en attente',
          error: 'PENDING_ORDERS_FETCH_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('pending-count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir le nombre de commandes en attente' })
  @ApiResponse({ status: 200, description: 'Nombre de commandes en attente' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async getPendingCount(@Request() req) {
    try {
      this.logger.log('📊 Récupération du compteur de commandes en attente', {
        userId: req.user?.id
      });

      const count = await this.ordersService.getPendingOrdersCount();

      this.logger.log(`✅ Compteur récupéré: ${count}`);

      return {
        success: true,
        count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération compteur:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération du compteur',
          error: 'PENDING_COUNT_FETCH_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les statistiques des commandes' })
  @ApiResponse({ status: 200, description: 'Statistiques des commandes' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async getStats(@Request() req) {
    try {
      this.logger.log('📊 Récupération des statistiques des commandes', {
        userId: req.user?.id
      });

      const stats = await this.ordersService.getOrderStats();

      this.logger.log('✅ Statistiques récupérées:', stats);

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération statistiques:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des statistiques',
          error: 'STATS_FETCH_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('customer/:phone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'VENDEUR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les commandes d\'un client' })
  @ApiParam({ name: 'phone', description: 'Numéro de téléphone du client' })
  @ApiResponse({ status: 200, description: 'Commandes du client' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Client non trouvé' })
  async findByCustomer(@Param('phone') phone: string, @Request() req) {
    try {
      this.logger.log('📞 Récupération des commandes du client', {
        phone,
        userId: req.user?.id
      });

      const customerOrders = await this.ordersService.getCustomerOrders(phone);

      this.logger.log(`✅ ${customerOrders.length} commandes trouvées pour le client ${phone}`);

      return {
        success: true,
        data: customerOrders,
        count: customerOrders.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération commandes client ${phone}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la récupération des commandes du client ${phone}`,
          error: 'CUSTOMER_ORDERS_FETCH_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir une commande par son ID' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande trouvée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async findOne(@Param('id') id: string, @Request() req) {
    try {
      // Si l'ID est "pending-count", retourner directement une erreur 400
      if (id === 'pending-count') {
        throw new HttpException(
          {
            success: false,
            message: 'Utilisez la route /api/orders/pending-count pour obtenir le compteur',
            error: 'BAD_REQUEST',
            timestamp: new Date().toISOString()
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log('🔍 Recherche de commande par ID', {
        orderId: id,
        userId: req.user?.id
      });

      const order = await this.ordersService.getOrderById(id);

      // Vérifier que l'utilisateur a accès à cette commande
      const user = req.user;
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
        if (order.userId !== user.id && order.customerPhone !== user.phone) {
          this.logger.warn('⛔ Tentative d\'accès non autorisée à une commande', {
            orderId: id,
            userId: user.id,
            customerPhone: order.customerPhone
          });
          
          throw new HttpException(
            {
              success: false,
              message: 'Accès non autorisé à cette commande',
              error: 'ACCESS_DENIED',
              timestamp: new Date().toISOString()
            },
            HttpStatus.FORBIDDEN
          );
        }
      }

      this.logger.log(`✅ Commande ${id} trouvée`);

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.status === 400 || error.status === 403) {
        throw error;
      }
      
      this.logger.error(`❌ Erreur récupération commande ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Commande ${id} non trouvée`,
          error: 'ORDER_NOT_FOUND',
          timestamp: new Date().toISOString()
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Obtenir une commande par son numéro' })
  @ApiParam({ name: 'orderNumber', description: 'Numéro de la commande' })
  @ApiResponse({ status: 200, description: 'Commande trouvée' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async findByNumber(@Param('orderNumber') orderNumber: string) {
    try {
      this.logger.log('🔍 Recherche de commande par numéro', { orderNumber });

      const order = await this.ordersService.getOrderByNumber(orderNumber);

      this.logger.log(`✅ Commande ${orderNumber} trouvée`);

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération commande ${orderNumber}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Commande ${orderNumber} non trouvée`,
          error: 'ORDER_NOT_FOUND',
          timestamp: new Date().toISOString()
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour une commande' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande mise à jour' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Request() req
  ) {
    try {
      this.logger.log('🔄 Mise à jour de commande', {
        orderId: id,
        updates: updateOrderDto,
        userId: req.user?.id
      });

      const updatedOrder = await this.ordersService.updateOrder(id, updateOrderDto, req.user.id);

      this.logger.log(`✅ Commande ${id} mise à jour`);

      return {
        success: true,
        message: 'Commande mise à jour avec succès',
        data: updatedOrder,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour commande ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la mise à jour de la commande: ${error.message}`,
          error: 'ORDER_UPDATE_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Valider ou rejeter une commande' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande validée/rejetée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async validate(
    @Param('id') id: string,
    @Body() validateOrderDto: ValidateOrderDto,
    @Request() req
  ) {
    try {
      this.logger.log('✅ Validation de commande', {
        orderId: id,
        action: validateOrderDto.action,
        userId: req.user?.id,
        reason: validateOrderDto.reason
      });

      const validatedOrder = await this.ordersService.validateOrder(id, validateOrderDto, req.user.id);

      this.logger.log(`✅ Commande ${id} ${validateOrderDto.action} avec succès`);

      return {
        success: true,
        message: `Commande ${validateOrderDto.action === 'validate' ? 'validée' : 'rejetée'} avec succès`,
        data: validatedOrder,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Erreur validation commande ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la validation de la commande: ${error.message}`,
          error: 'ORDER_VALIDATION_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une commande' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande supprimée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async remove(@Param('id') id: string) {
    try {
      this.logger.log('🗑️ Suppression de commande', { orderId: id });

      const result = await this.ordersService.deleteOrder(id);

      this.logger.log(`✅ Commande ${id} supprimée`);

      return {
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Erreur suppression commande ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la suppression de la commande: ${error.message}`,
          error: 'ORDER_DELETION_FAILED',
          timestamp: new Date().toISOString()
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}