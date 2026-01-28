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
import { SupportResponseDto } from './dto/support-response.dto';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../shared/cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

const memoryStorageConfig = {
  storage: memoryStorage(),
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
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

@Controller('supports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportsController {
  private readonly logger = new Logger(SupportsController.name);

  constructor(
    private readonly supportsService: SupportsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async create(
    @Body() createSupportDto: CreateSupportDto,
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    this.logger.log('=== 🚀 DÉBUT CRÉATION SUPPORT ===');
    this.logger.log('📦 Données reçues:', createSupportDto);

    // Prétraiter les données
    const processedData = this.preprocessSupportData(createSupportDto);
    
    // Traiter les images uploadées
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        this.logger.log(`📸 Upload de ${files.length} image(s) vers Cloudinary...`);
        
        // Upload chaque image individuellement pour de meilleurs logs
        for (let i = 0; i < files.length; i++) {
          try {
            const result = await this.cloudinaryService.uploadImage(files[i]);
            imageUrls.push(result.secure_url);
            this.logger.log(`✅ Image ${i + 1} uploadée: ${result.secure_url}`);
          } catch (uploadError) {
            this.logger.error(`❌ Erreur upload image ${i + 1}:`, uploadError);
            throw uploadError;
          }
        }
      } catch (error) {
        this.logger.error('❌ Erreur lors de l\'upload des images:', error);
        throw new BadRequestException(
          `Erreur lors de l'upload des images: ${error.message}`,
        );
      }
    }
    
    // Ajouter les URLs d'images au DTO
    processedData.images = imageUrls;
    
    this.logger.log('🔄 Appel du service avec données:', {
      name: processedData.name,
      sku: processedData.sku,
      imagesCount: processedData.images.length,
      userId: req.user.id,
    });
    
    const result = await this.supportsService.create(processedData, req.user.id);
    
    this.logger.log('✅ Support créé avec succès:', {
      id: result.id,
      sku: result.sku,
      imagesCount: result.images.length,
    });
    
    return {
      success: true,
      data: result,
      message: 'Support créé avec succès',
    };
  }

  @Get()
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('search') search?: string,
    @Query('theme') theme?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`📋 Récupération des supports - page: ${page}, limit: ${limit}`);
    
    const themeEnum = theme as SupportTheme;
    const typeEnum = type as SupportType;
    const statusEnum = status as SupportStatus;
    
    const result = await this.supportsService.findAll(
      page, 
      limit, 
      search, 
      themeEnum, 
      typeEnum, 
      statusEnum
    );
    
    this.logger.log(`✅ ${result.data.length} supports récupérés`);
    
    return result;
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  async getLowStock() {
    return this.supportsService.getLowStock();
  }

  @Get('categories')
  async getCategories() {
    return this.supportsService.getCategories();
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStats() {
    return this.supportsService.getStats();
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
    this.logger.log(`🔍 Récupération du support avec ID: ${id}`);
    const result = await this.supportsService.findOne(id);
    
    this.logger.log(`✅ Support ${id} récupéré:`, {
      name: result.name,
      sku: result.sku,
      imagesCount: result.images.length,
    });
    
    return {
      success: true,
      data: result,
    };
  }

  @Get('sku/:sku')
  async findBySku(@Param('sku') sku: string) {
    return this.supportsService.findBySku(sku);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('images', 10, memoryStorageConfig))
  async update(
    @Param('id') id: string,
    @Body() updateSupportDto: UpdateSupportDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    this.logger.log(`=== 🔄 MISE À JOUR SUPPORT ${id} ===`);
    this.logger.log('📦 Données reçues:', updateSupportDto);

    // Prétraiter les données
    const processedData = this.preprocessSupportData(updateSupportDto);
    
    // Traiter les nouvelles images
    let newImageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        this.logger.log(`📸 Upload de ${files.length} nouvelle(s) image(s)...`);
        
        for (let i = 0; i < files.length; i++) {
          try {
            const result = await this.cloudinaryService.uploadImage(files[i]);
            newImageUrls.push(result.secure_url);
            this.logger.log(`✅ Nouvelle image ${i + 1}: ${result.secure_url}`);
          } catch (uploadError) {
            this.logger.error(`❌ Erreur upload nouvelle image ${i + 1}:`, uploadError);
            throw uploadError;
          }
        }
      } catch (error) {
        this.logger.error('❌ Erreur upload nouvelles images:', error);
        throw new BadRequestException(`Erreur upload: ${error.message}`);
      }
    }
    
    // Gérer les images existantes et nouvelles
    const existingImages = updateSupportDto.existingImages || [];
    const allImages = [...existingImages, ...newImageUrls];
    
    this.logger.log('📸 Images totales:', {
      existantes: existingImages.length,
      nouvelles: newImageUrls.length,
      total: allImages.length,
      urls: allImages,
    });
    
    // Mettre à jour avec les images complètes
    const updatedData = {
      ...processedData,
      images: allImages,
    };
    
    this.logger.log('🔄 Appel du service avec données:', {
      id,
      name: updatedData.name,
      imagesCount: updatedData.images.length,
    });
    
    const result = await this.supportsService.update(id, updatedData);
    
    this.logger.log(`✅ Support ${id} mis à jour avec succès`);
    
    return {
      success: true,
      data: result,
      message: 'Support mis à jour avec succès',
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string) {
    await this.supportsService.remove(id);
    
    return {
      success: true,
      message: 'Support supprimé avec succès',
    };
  }

  @Post(':id/image')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FilesInterceptor('image', 1, memoryStorageConfig))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Aucune image fournie');
    }
    
    const result = await this.supportsService.uploadImage(id, files[0]);
    
    return {
      success: true,
      data: result,
      message: 'Image ajoutée avec succès',
    };
  }

  @Delete(':id/image')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async removeImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
  ) {
    const result = await this.supportsService.removeImage(id, imageUrl);
    
    return {
      success: true,
      data: result,
      message: 'Image supprimée avec succès',
    };
  }

  @Get('test/images')
  async testImages() {
    return {
      success: true,
      message: 'Test images endpoint',
      cloudinaryConfig: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: 'oplaisir/supports'
      },
      sampleImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
    };
  }

  // Méthode utilitaire pour prétraiter les données du support
  private preprocessSupportData(dto: any): any {
    const processed = { ...dto };
    
    this.logger.log('🔄 Prétraitement des données:', {
      name: dto.name,
      sku: dto.sku,
      imagesRaw: dto.images,
      compatibleThemesRaw: dto.compatibleThemes,
    });
    
    // Liste des champs numériques
    const numberFields = [
      'purchasePrice', 'sellingPrice', 'tva', 'weight',
      'stock', 'minStock', 'maxStock', 'capacity'
    ];
    
    // Convertir les chaînes en nombres
    numberFields.forEach(field => {
      if (processed[field] !== undefined && processed[field] !== null) {
        if (typeof processed[field] === 'string') {
          const numValue = parseFloat(processed[field]);
          processed[field] = isNaN(numValue) ? 
            (field === 'tva' ? 18 : 
             field === 'minStock' ? 5 : 
             field === 'maxStock' ? 100 : 
             field === 'capacity' ? 1 : 0) : 
            numValue;
        }
      } else {
        // Valeurs par défaut si le champ est undefined
        if (field === 'tva') processed[field] = 18;
        else if (field === 'minStock') processed[field] = 5;
        else if (field === 'maxStock') processed[field] = 100;
        else if (field === 'capacity') processed[field] = 1;
        else processed[field] = 0;
      }
    });
    
    // Gérer compatibleThemes - s'assurer que c'est un tableau
    if (processed.compatibleThemes) {
      if (typeof processed.compatibleThemes === 'string') {
        try {
          processed.compatibleThemes = JSON.parse(processed.compatibleThemes);
        } catch (e) {
          this.logger.warn('⚠️ Erreur parsing compatibleThemes, utilisation tableau vide');
          processed.compatibleThemes = [];
        }
      }
      
      if (!Array.isArray(processed.compatibleThemes)) {
        this.logger.warn('⚠️ compatibleThemes n\'est pas un tableau, conversion');
        processed.compatibleThemes = [];
      }
    } else {
      processed.compatibleThemes = [];
    }
    
    // Gérer images - s'assurer que c'est un tableau
    if (processed.images) {
      if (!Array.isArray(processed.images)) {
        this.logger.warn('⚠️ images n\'est pas un tableau, conversion');
        processed.images = typeof processed.images === 'string' 
          ? [processed.images] 
          : [];
      }
    } else {
      processed.images = [];
    }
    
    // Valeurs par défaut
    if (!processed.weightUnit || processed.weightUnit.trim() === '') {
      processed.weightUnit = 'g';
    }
    
    if (!processed.type || processed.type.trim() === '') processed.type = 'boite';
    if (!processed.theme || processed.theme.trim() === '') processed.theme = 'anniversaire';
    if (!processed.material || processed.material.trim() === '') processed.material = 'carton';
    if (!processed.status || processed.status.trim() === '') processed.status = 'actif';
    
    // Supprimer les champs qui ne sont pas dans le modèle de données
    delete processed.existingImages;
    
    this.logger.log('✅ Données prétraitées:', {
      name: processed.name,
      sku: processed.sku,
      images: processed.images,
      imagesCount: processed.images.length,
      compatibleThemes: processed.compatibleThemes,
      compatibleThemesCount: processed.compatibleThemes.length,
    });
    
    return processed;
  }
}