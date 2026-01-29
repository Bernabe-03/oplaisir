import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  UseGuards,
  Request,
  ParseEnumPipe,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { memoryStorage, Multer  } from 'multer';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductStatus } from '@prisma/client';

// Configuration de multer pour le stockage en mémoire (au lieu du disque)
const memoryStorageConfig = {
  storage: memoryStorage(),
  fileFilter: (
    req: Request,
    file: Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const mimetypeValid = allowedTypes.test(file.mimetype);
    const extnameValid = allowedTypes.test(
      file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)?.[0] || '',
    );

    if (extnameValid && mimetypeValid) {
      return callback(null, true);
    }

    callback(
      new BadRequestException(
        'Seules les images sont autorisées (jpeg, jpg, png, webp, gif)',
      ),
      false,
    );
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async create(
    @Body() createProductDto: CreateProductDto,
    @Request() req,
    @UploadedFiles() files: Multer.File[],
  ) {
    console.log('=== 🚀 DÉBUT CRÉATION PRODUIT (Controller) ===');
    console.log('📦 Données reçues dans le controller:', createProductDto);

    // Convertir et traiter les données
    const processedData = this.preprocessProductData(createProductDto);
    
    // Traiter les images uploadées vers Cloudinary
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        console.log('📸 Upload des images vers Cloudinary...');
        imageUrls = await this.cloudinaryService.uploadMultipleImages(files);
        console.log('✅ Images uploadées sur Cloudinary:', imageUrls);
      } catch (error) {
        console.error('❌ Erreur lors de l\'upload des images:', error);
        throw new BadRequestException(
          `Erreur lors de l'upload des images: ${error.message}`,
        );
      }
    }
    
    console.log('🔄 Appel du service avec données:', {
      ...processedData,
      images: imageUrls,
      userId: req.user.id
    });
    
    return this.productsService.create(processedData, req.user.id, imageUrls);
  }

  @Get()
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status', new ParseEnumPipe(ProductStatus, { optional: true })) status?: ProductStatus,
  ) {
    return this.productsService.findAll(page, limit, search, category, status);
  }

  // Nouveaux endpoints pour la gestion des dates d'expiration
  @Get('expired')
  @Roles('ADMIN', 'MANAGER', 'STOCKISTE')
  async getExpiredProducts() {
    return this.productsService.getExpiredProducts();
  }

  @Get('expiring-soon')
  @Roles('ADMIN', 'MANAGER', 'STOCKISTE')
  async getProductsExpiringSoon(
    @Query('days') days: string = '30'
  ) {
    return this.productsService.getProductsExpiringSoon(parseInt(days));
  }

  @Get('expiry-stats')
  @Roles('ADMIN', 'MANAGER')
  async getExpiryStats() {
    return this.productsService.getExpiryStats();
  }

  @Put('update-expiry-status')
  @Roles('ADMIN', 'MANAGER')
  async updateExpiryStatus(
    @Body() body: { productIds: string[], status: ProductStatus }
  ) {
    return this.productsService.updateExpiryStatus(body.productIds, body.status);
  }

  @Get('validate-expiry/:productId')
  @Roles('ADMIN', 'MANAGER', 'STOCKISTE')
  async validateProductExpiry(@Param('productId') productId: string) {
    return this.productsService.validateProductExpiry(productId);
  }

  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER', 'STOCKISTE')
  async getLowStock() {
    return this.productsService.getLowStock();
  }

  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  async getStats() {
    return this.productsService.getStats();
  }

  @Get('search')
  async search(@Query('q') query: string) {
    return this.productsService.findAll(1, 20, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // Nouvel endpoint pour récupérer un produit avec ses avis
  @Get(':id/with-reviews')
  async findOneWithReviews(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('rating') rating?: number,
    @Query('sortBy') sortBy?: string,
  ) {
    const query = {
      page: Number(page),
      limit: Number(limit),
      rating: rating ? Number(rating) : undefined,
      sortBy,
    };
    return this.productsService.findOneWithReviews(id, query);
  }

  @Get('sku/:sku')
  async findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req,
    @UploadedFiles() files: Multer.File[],
  ) {
    console.log('=== 🔄 DÉBUT MISE À JOUR PRODUIT (Controller) ===');
    console.log('📦 Données reçues pour mise à jour:', updateProductDto);

    // Convertir et traiter les données
    const processedData = this.preprocessProductData(updateProductDto);
    
    // Traiter les nouvelles images vers Cloudinary
    let newImageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        console.log('📸 Upload des nouvelles images vers Cloudinary...');
        newImageUrls = await this.cloudinaryService.uploadMultipleImages(files);
        console.log('✅ Nouvelles images uploadées sur Cloudinary:', newImageUrls);
      } catch (error) {
        console.error('❌ Erreur lors de l\'upload des nouvelles images:', error);
        throw new BadRequestException(
          `Erreur lors de l'upload des nouvelles images: ${error.message}`,
        );
      }
    }
    
    // Utiliser les images existantes ou par défaut
    const existingImages = updateProductDto.existingImages || [];
    const allImages = [...existingImages, ...newImageUrls];
    
    console.log('📸 Images totales:', allImages);
    console.log('🔄 Appel du service avec données:', {
      ...processedData,
      images: allImages,
      userId: req.user.id
    });
    
    return this.productsService.update(id, processedData, req.user.id, allImages);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post('bulk-delete')
  @Roles('ADMIN', 'MANAGER')
  async bulkDelete(@Body() body: { ids: string[] }) {
    return this.productsService.bulkDelete(body.ids);
  }

  @Put(':id/stock')
  @Roles('ADMIN', 'MANAGER', 'STOCKISTE')
  async updateStock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    return this.productsService.updateStock(id, body.quantity);
  }

  @Get('export/csv')
  @Roles('ADMIN', 'MANAGER')
  async exportToCSV() {
    return { message: 'Export CSV à implémenter' };
  }

  // Méthode utilitaire pour prétraiter les données du produit
  private preprocessProductData(dto: any): any {
    const processed = { ...dto };
    
    // Liste des champs numériques (ajouter les nouveaux)
    const numberFields = [
      'purchasePrice', 'sellingPrice', 'tva', 'weight',
      'stock', 'minStock', 'maxStock', 'shelfLifeMonths'
    ];
    
    // Convertir les chaînes en nombres
    numberFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        if (typeof processed[field] === 'string') {
          const numValue = parseFloat(processed[field]);
          processed[field] = isNaN(numValue) ? 
            (field === 'tva' ? 18 : 
             field === 'minStock' ? 10 : 
             field === 'maxStock' ? 100 : 
             field === 'shelfLifeMonths' ? 0 : 0) : 
            numValue;
        }
      } else {
        // Valeurs par défaut
        if (field === 'tva') processed[field] = 18;
        else if (field === 'minStock') processed[field] = 10;
        else if (field === 'maxStock') processed[field] = 100;
        else if (field === 'shelfLifeMonths') processed[field] = 0;
        else if (field === 'stock') processed[field] = 0;
        else processed[field] = 0;
      }
    });
    
    // Convertir les dates
    const dateFields = ['expirationDate', 'manufacturingDate'];
    dateFields.forEach(field => {
      if (processed[field] && typeof processed[field] === 'string') {
        const date = new Date(processed[field]);
        if (!isNaN(date.getTime())) {
          processed[field] = date;
        } else {
          delete processed[field];
        }
      }
    });
    
    // Gérer le statut automatiquement si une date d'expiration est passée
    if (processed.expirationDate) {
      const expiryDate = new Date(processed.expirationDate);
      const today = new Date();
      if (expiryDate < today) {
        processed.status = ProductStatus.EXPIRE;
      }
    }
    
    // S'assurer que les unités ont des valeurs par défaut
    if (!processed.unit || processed.unit.trim() === '') processed.unit = 'pièce';
    if (!processed.weightUnit || processed.weightUnit.trim() === '') processed.weightUnit = 'g';
    if (!processed.storageConditions || processed.storageConditions.trim() === '') {
      processed.storageConditions = 'température ambiante';
    }
    
    // Supprimer les champs gérés séparément
    delete processed.images;
    delete processed.existingImages;
    
    return processed;
  }
}