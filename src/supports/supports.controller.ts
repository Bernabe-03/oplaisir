// import {
//   Controller,
//   Get,
//   Post,
//   Put,          // ← IMPORT PUT
//   Delete,
//   Body,
//   Param,
//   Query,
//   UseInterceptors,
//   UploadedFiles,
//   ParseIntPipe,
//   UseGuards,
//   Request,
//   BadRequestException,
//   Logger,
// } from '@nestjs/common';
// import { FilesInterceptor } from '@nestjs/platform-express';
// import { SupportsService } from './supports.service';
// import { CreateSupportDto, SupportTheme, SupportType, SupportStatus } from './dto/create-support.dto';
// import { UpdateSupportDto } from './dto/update-support.dto';
// import { memoryStorage } from 'multer';
// import { Express } from 'express';
// import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
// import { JwtAuthGuard } from '../auth/guards/jwt.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { UserRole } from '@prisma/client';

// const memoryStorageConfig = {
//   storage: memoryStorage(),
//   fileFilter: (
//     req: Request,
//     file: Express.Multer.File,
//     callback: (error: Error | null, acceptFile: boolean) => void,
//   ) => {
//     const allowedTypes = /jpeg|jpg|png|webp|gif/;
//     const mimetypeValid = allowedTypes.test(file.mimetype);
//     const extnameValid = allowedTypes.test(
//       file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)?.[0] || '',
//     );

//     if (extnameValid && mimetypeValid) {
//       return callback(null, true);
//     }

//     callback(
//       new BadRequestException(
//         'Seules les images sont autorisées (jpeg, jpg, png, webp, gif)',
//       ),
//       false,
//     );
//   },
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB
//   },
// };

// @Controller('supports')
// @UseGuards(JwtAuthGuard, RolesGuard)
// export class SupportsController {
//   private readonly logger = new Logger(SupportsController.name);

//   constructor(
//     private readonly supportsService: SupportsService,
//     private readonly cloudinaryService: CloudinaryService,
//   ) {}

//   @Post()
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
//   async create(
//     @Body() createSupportDto: CreateSupportDto,
//     @Request() req,
//     @UploadedFiles() files: Express.Multer.File[],
//   ) {
//     this.logger.log('=== 🚀 DÉBUT CRÉATION SUPPORT ===');
//     this.logger.log('📦 Données reçues:', createSupportDto);

//     const processedData = this.preprocessSupportData(createSupportDto);
    
//     let imageUrls: string[] = [];
//     if (files && files.length > 0) {
//       try {
//         this.logger.log(`📸 Upload de ${files.length} image(s) vers Cloudinary...`);
//         for (let i = 0; i < files.length; i++) {
//           const result = await this.cloudinaryService.uploadImage(files[i]);
//           imageUrls.push(result.secure_url);
//           this.logger.log(`✅ Image ${i + 1} uploadée: ${result.secure_url}`);
//         }
//       } catch (error) {
//         this.logger.error('❌ Erreur lors de l\'upload des images:', error);
//         throw new BadRequestException(
//           `Erreur lors de l'upload des images: ${error.message}`,
//         );
//       }
//     }
    
//     processedData.images = imageUrls;
    
//     const result = await this.supportsService.create(processedData, req.user.id);
    
//     return {
//       success: true,
//       data: result,
//       message: 'Support créé avec succès',
//     };
//   }

//   @Get()
//   async findAll(
//     @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
//     @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
//     @Query('search') search?: string,
//     @Query('theme') theme?: string,
//     @Query('type') type?: string,
//     @Query('status') status?: string,
//   ) {
//     this.logger.log(`📋 Récupération des supports - page: ${page}, limit: ${limit}`);
    
//     const themeEnum = theme as SupportTheme;
//     const typeEnum = type as SupportType;
//     const statusEnum = status as SupportStatus;
    
//     const result = await this.supportsService.findAll(
//       page, 
//       limit, 
//       search, 
//       themeEnum, 
//       typeEnum, 
//       statusEnum
//     );
    
//     return result;
//   }

//   @Get('low-stock')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
//   async getLowStock() {
//     return this.supportsService.getLowStock();
//   }

//   @Get('categories')
//   async getCategories() {
//     return this.supportsService.getCategories();
//   }

//   @Get('stats')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async getStats() {
//     return this.supportsService.getStats();
//   }

//   @Get('search')
//   async search(@Query('q') query: string) {
//     return this.supportsService.findAll(1, 20, query);
//   }

//   @Get('theme/:theme')
//   async filterByTheme(@Param('theme') theme: string) {
//     return this.supportsService.filterByTheme(theme);
//   }

//   @Get(':id')
//   async findOne(@Param('id') id: string) {
//     this.logger.log(`🔍 Récupération du support avec ID: ${id}`);
//     const result = await this.supportsService.findOne(id);
//     return {
//       success: true,
//       data: result,
//     };
//   }

//   @Get('sku/:sku')
//   async findBySku(@Param('sku') sku: string) {
//     return this.supportsService.findBySku(sku);
//   }

//   @Put(':id')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
//   async update(
//     @Param('id') id: string,
//     @Body() updateSupportDto: UpdateSupportDto,
//     @UploadedFiles() files: Express.Multer.File[],
//   ) {
//     this.logger.log(`=== 🔄 MISE À JOUR SUPPORT ${id} ===`);
//     this.logger.log('📦 Données reçues:', updateSupportDto);

//     const processedData = this.preprocessSupportData(updateSupportDto);
    
//     let newImageUrls: string[] = [];
//     if (files && files.length > 0) {
//       try {
//         this.logger.log(`📸 Upload de ${files.length} nouvelle(s) image(s)...`);
//         for (let i = 0; i < files.length; i++) {
//           const result = await this.cloudinaryService.uploadImage(files[i]);
//           newImageUrls.push(result.secure_url);
//           this.logger.log(`✅ Nouvelle image ${i + 1}: ${result.secure_url}`);
//         }
//       } catch (error) {
//         this.logger.error('❌ Erreur upload nouvelles images:', error);
//         throw new BadRequestException(`Erreur upload: ${error.message}`);
//       }
//     }
    
//     const existingImages = updateSupportDto.existingImages || [];
//     const allImages = [...existingImages, ...newImageUrls];
    
//     this.logger.log('📸 Images totales:', {
//       existantes: existingImages.length,
//       nouvelles: newImageUrls.length,
//       total: allImages.length,
//     });
    
//     const updatedData = {
//       ...processedData,
//       images: allImages,
//     };
    
//     const result = await this.supportsService.update(id, updatedData);
    
//     return {
//       success: true,
//       data: result,
//       message: 'Support mis à jour avec succès',
//     };
//   }

//   // ✅ NOUVEL ENDPOINT – Mise à jour exclusive du stock (PUT)
//   @Put(':id/stock')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
//   async updateStock(
//     @Param('id') id: string,
//     @Body('quantity') quantity: number,
//   ) {
//     this.logger.log(`📦 Mise à jour du stock du support ${id} → ${quantity}`);
    
//     if (quantity === undefined || quantity < 0) {
//       throw new BadRequestException('La quantité doit être un nombre positif');
//     }
    
//     // Appel à update() avec seulement le champ stock
//     const result = await this.supportsService.update(id, {
//       stock: quantity,
//     });
    
//     return {
//       success: true,
//       data: result,
//       message: 'Stock mis à jour avec succès',
//     };
//   }

//   @Delete(':id')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async remove(@Param('id') id: string) {
//     await this.supportsService.remove(id);
//     return {
//       success: true,
//       message: 'Support supprimé avec succès',
//     };
//   }

//   @Post(':id/image')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @UseInterceptors(FilesInterceptor('image', 1, memoryStorageConfig))
//   async uploadImage(
//     @Param('id') id: string,
//     @UploadedFiles() files: Express.Multer.File[],
//   ) {
//     if (!files || files.length === 0) {
//       throw new BadRequestException('Aucune image fournie');
//     }
//     const result = await this.supportsService.uploadImage(id, files[0]);
//     return {
//       success: true,
//       data: result,
//       message: 'Image ajoutée avec succès',
//     };
//   }

//   @Delete(':id/image')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   async removeImage(
//     @Param('id') id: string,
//     @Body('imageUrl') imageUrl: string,
//   ) {
//     const result = await this.supportsService.removeImage(id, imageUrl);
//     return {
//       success: true,
//       data: result,
//       message: 'Image supprimée avec succès',
//     };
//   }

//   @Get('test/images')
//   async testImages() {
//     return {
//       success: true,
//       message: 'Test images endpoint',
//       cloudinaryConfig: {
//         cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//         folder: 'oplaisir/supports'
//       },
//       sampleImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
//     };
//   }

//   // ----------------------------------------------------------------
//   // Méthode utilitaire de prétraitement
//   // ----------------------------------------------------------------
//   private preprocessSupportData(dto: any): any {
//     const processed = { ...dto };
    
//     this.logger.log('🔄 Prétraitement des données:', {
//       name: dto.name,
//       sku: dto.sku,
//     });
    
//     const numberFields = [
//       'purchasePrice', 'sellingPrice', 'tva', 'weight',
//       'stock', 'minStock', 'maxStock', 'capacity'
//     ];
    
//     numberFields.forEach(field => {
//       if (processed[field] !== undefined && processed[field] !== null) {
//         if (typeof processed[field] === 'string') {
//           const numValue = parseFloat(processed[field]);
//           processed[field] = isNaN(numValue) ? null : numValue;
//         }
//       }
//     });
    
//     if (processed.compatibleThemes !== undefined) {
//       if (typeof processed.compatibleThemes === 'string') {
//         try {
//           processed.compatibleThemes = JSON.parse(processed.compatibleThemes);
//         } catch (e) {
//           this.logger.warn('⚠️ Erreur parsing compatibleThemes, utilisation tableau vide');
//           processed.compatibleThemes = [];
//         }
//       }
//       if (!Array.isArray(processed.compatibleThemes)) {
//         processed.compatibleThemes = [];
//       }
//     }
    
//     if (processed.images !== undefined) {
//       if (!Array.isArray(processed.images)) {
//         processed.images = typeof processed.images === 'string' 
//           ? [processed.images] 
//           : [];
//       }
//     }
//     delete processed.existingImages;
    
//     return processed;
//   }
// }








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
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SupportsService } from './supports.service';
import { CreateSupportDto, SupportTheme, SupportType, SupportStatus } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { memoryStorage } from 'multer';
import { Express } from 'express';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

const memoryStorageConfig = {
  storage: memoryStorage(),
  fileFilter: (req, file, callback) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const mimetypeValid = allowedTypes.test(file.mimetype);
    const extnameValid = allowedTypes.test(file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)?.[0] || '');
    if (extnameValid && mimetypeValid) return callback(null, true);
    callback(new BadRequestException('Seules les images sont autorisées'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

@Controller('supports')
export class SupportsController {
  private readonly logger = new Logger(SupportsController.name);

  constructor(
    private readonly supportsService: SupportsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // === ROUTES PUBLIQUES ===
  @Get()
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('search') search?: string,
    @Query('theme') theme?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const themeEnum = theme as SupportTheme;
    const typeEnum = type as SupportType;
    const statusEnum = status as SupportStatus;
    return this.supportsService.findAll(page, limit, search, themeEnum, typeEnum, statusEnum);
  }

  @Get('categories')
  async getCategories() {
    return this.supportsService.getCategories();
  }

  @Get('search')
  async search(@Query('q') query: string) {
    return this.supportsService.findAll(1, 20, query);
  }

  @Get('theme/:theme')
  async filterByTheme(@Param('theme') theme: string) {
    return this.supportsService.filterByTheme(theme);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.supportsService.findOne(id);
    return { success: true, data: result };
  }

  @Get('sku/:sku')
  async findBySku(@Param('sku') sku: string) {
    return this.supportsService.findBySku(sku);
  }

  // === ROUTES PROTÉGÉES ===
  @Get('low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  async getLowStock() {
    return this.supportsService.getLowStock();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStats() {
    return this.supportsService.getStats();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async create(
    @Body() createSupportDto: CreateSupportDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const processedData = this.preprocessSupportData(createSupportDto);
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const result = await this.cloudinaryService.uploadImage(files[i]);
        imageUrls.push(result.secure_url);
      }
    }
    processedData.images = imageUrls;
    const result = await this.supportsService.create(processedData, req.user.id);
    return { success: true, data: result, message: 'Support créé avec succès' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async update(
    @Param('id') id: string,
    @Body() updateSupportDto: UpdateSupportDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const processedData = this.preprocessSupportData(updateSupportDto);
    let newImageUrls: string[] = [];
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const result = await this.cloudinaryService.uploadImage(files[i]);
        newImageUrls.push(result.secure_url);
      }
    }
    const existingImages = updateSupportDto.existingImages || [];
    const allImages = [...existingImages, ...newImageUrls];
    const updatedData = { ...processedData, images: allImages };
    const result = await this.supportsService.update(id, updatedData);
    return { success: true, data: result, message: 'Support mis à jour avec succès' };
  }

  @Put(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  async updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    if (quantity === undefined || quantity < 0) {
      throw new BadRequestException('La quantité doit être un nombre positif');
    }
    const result = await this.supportsService.update(id, { stock: quantity });
    return { success: true, data: result, message: 'Stock mis à jour avec succès' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string) {
    await this.supportsService.remove(id);
    return { success: true, message: 'Support supprimé avec succès' };
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('image', 1, memoryStorageConfig))
  async uploadImage(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('Aucune image fournie');
    const result = await this.supportsService.uploadImage(id, files[0]);
    return { success: true, data: result, message: 'Image ajoutée avec succès' };
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async removeImage(@Param('id') id: string, @Body('imageUrl') imageUrl: string) {
    const result = await this.supportsService.removeImage(id, imageUrl);
    return { success: true, data: result, message: 'Image supprimée avec succès' };
  }

  @Get('test/images')
  async testImages() {
    return {
      success: true,
      message: 'Test images endpoint',
      cloudinaryConfig: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: 'oplaisir/supports',
      },
      sampleImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    };
  }

  private preprocessSupportData(dto: any): any {
    const processed = { ...dto };
    const numberFields = ['purchasePrice', 'sellingPrice', 'tva', 'weight', 'stock', 'minStock', 'maxStock', 'capacity'];
    numberFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        if (typeof processed[field] === 'string') {
          const numValue = parseFloat(processed[field]);
          processed[field] = isNaN(numValue) ? null : numValue;
        }
      }
    });
    if (processed.compatibleThemes !== undefined) {
      if (typeof processed.compatibleThemes === 'string') {
        try {
          processed.compatibleThemes = JSON.parse(processed.compatibleThemes);
        } catch (e) {
          processed.compatibleThemes = [];
        }
      }
      if (!Array.isArray(processed.compatibleThemes)) processed.compatibleThemes = [];
    }
    if (processed.images !== undefined) {
      if (!Array.isArray(processed.images)) {
        processed.images = typeof processed.images === 'string' ? [processed.images] : [];
      }
    }
    delete processed.existingImages;
    return processed;
  }
}