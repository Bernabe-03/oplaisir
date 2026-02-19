// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   Query,
//   UseInterceptors,
//   UploadedFile,
//   UseGuards,
//   ParseIntPipe,
//   DefaultValuePipe,
//   BadRequestException,
//   Res,
//   Put,   // ← IMPORT PUT
// } from '@nestjs/common';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
// import type { Response } from 'express';
// import { createObjectCsvWriter } from 'csv-writer';
// import * as PDFDocument from 'pdfkit';
// import { readFileSync, unlinkSync } from 'fs';
// import { join } from 'path';

// import { CoffretsService } from './coffrets.service';
// import { CreateCoffretDto } from './dto/create-coffret.dto';
// import { UpdateCoffretDto } from './dto/update-coffret.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { UserRole } from '@prisma/client';
// import { Express } from 'express';

// @ApiTags('coffrets')
// @ApiBearerAuth()
// @Controller('coffrets')
// @UseGuards(JwtAuthGuard, RolesGuard)
// export class CoffretsController {
//   constructor(private readonly coffretsService: CoffretsService) {}

//   @Post()
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Créer un nouveau coffret' })
//   @ApiResponse({ status: 201, description: 'Coffret créé avec succès' })
//   @ApiResponse({ status: 400, description: 'Données invalides' })
//   @ApiResponse({ status: 409, description: 'Nom de coffret déjà utilisé' })
//   create(@Body() createCoffretDto: CreateCoffretDto) {
//     return this.coffretsService.create(createCoffretDto);
//   }

//   @Get()
//   @ApiOperation({ summary: 'Récupérer tous les coffrets' })
//   @ApiResponse({ status: 200, description: 'Liste des coffrets' })
//   findAll(
//     @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
//     @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
//     @Query('theme') theme?: string,
//     @Query('type') type?: string,
//     @Query('status') status?: string,
//     @Query('search') search?: string,
//     @Query('minPrice') minPrice?: string,
//     @Query('maxPrice') maxPrice?: string,
//     @Query('minStock') minStock?: string,
//     @Query('maxStock') maxStock?: string,
//   ) {
//     const skip = (page - 1) * limit;
    
//     let where: any = {};
    
//     if (theme) where.theme = theme;
//     if (type) where.type = type;
//     if (status) where.status = status;
    
//     if (search) {
//       where.OR = [
//         { name: { contains: search, mode: 'insensitive' } },
//         { description: { contains: search, mode: 'insensitive' } },
//       ];
//     }
    
//     if (minPrice || maxPrice) {
//       where.price = {};
//       if (minPrice) where.price.gte = parseFloat(minPrice);
//       if (maxPrice) where.price.lte = parseFloat(maxPrice);
//     }
    
//     if (minStock || maxStock) {
//       where.stock = {};
//       if (minStock) where.stock.gte = parseInt(minStock);
//       if (maxStock) where.stock.lte = parseInt(maxStock);
//     }

//     return this.coffretsService.findAll({
//       skip,
//       take: limit,
//       where,
//       orderBy: { createdAt: 'desc' },
//     });
//   }

//   @Get(':id')
//   @ApiOperation({ summary: 'Récupérer un coffret par ID' })
//   @ApiResponse({ status: 200, description: 'Coffret trouvé' })
//   @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
//   findOne(@Param('id') id: string) {
//     return this.coffretsService.findOne(id);
//   }

//   @Patch(':id')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Mettre à jour un coffret' })
//   @ApiResponse({ status: 200, description: 'Coffret mis à jour' })
//   @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
//   @ApiResponse({ status: 409, description: 'Nom de coffret déjà utilisé' })
//   update(@Param('id') id: string, @Body() updateCoffretDto: UpdateCoffretDto) {
//     return this.coffretsService.update(id, updateCoffretDto);
//   }

//   @Delete(':id')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Supprimer un coffret' })
//   @ApiResponse({ status: 200, description: 'Coffret supprimé' })
//   @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
//   remove(@Param('id') id: string) {
//     return this.coffretsService.remove(id);
//   }

//   // ✅ CORRIGÉ : PUT au lieu de PATCH pour correspondre à l'appel frontend
//   @Put(':id/stock')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
//   @ApiOperation({ summary: 'Mettre à jour le stock d\'un coffret' })
//   updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
//     return this.coffretsService.updateStock(id, quantity);
//   }

//   @Post(':id/reserve')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
//   @ApiOperation({ summary: 'Réserver du stock pour un coffret' })
//   reserveStock(@Param('id') id: string, @Body() body: { quantity: number }) {
//     return this.coffretsService.reserveStock(id, body.quantity);
//   }

//   @Post(':id/release')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
//   @ApiOperation({ summary: 'Libérer du stock réservé pour un coffret' })
//   releaseStock(@Param('id') id: string, @Body() body: { quantity: number }) {
//     return this.coffretsService.releaseStock(id, body.quantity);
//   }

//   @Get('search/:query')
//   @ApiOperation({ summary: 'Rechercher des coffrets' })
//   search(@Param('query') query: string) {
//     return this.coffretsService.search(query);
//   }

//   @Get('theme/:theme')
//   @ApiOperation({ summary: 'Filtrer les coffrets par thème' })
//   findByTheme(@Param('theme') theme: string) {
//     return this.coffretsService.findByTheme(theme);
//   }

//   @Get('type/:type')
//   @ApiOperation({ summary: 'Filtrer les coffrets par type' })
//   findByType(@Param('type') type: string) {
//     return this.coffretsService.findByType(type);
//   }

//   @Get('low-stock')
//   @ApiOperation({ summary: 'Récupérer les coffrets en faible stock' })
//   findLowStock(@Query('threshold') threshold: string) {
//     return this.coffretsService.findLowStock(
//       threshold ? parseInt(threshold) : undefined
//     );
//   }

//   @Get('stats/overview')
//   @ApiOperation({ summary: 'Obtenir les statistiques des coffrets' })
//   getStats() {
//     return this.coffretsService.getStats();
//   }

//   @Get('stats/best-sellers')
//   @ApiOperation({ summary: 'Obtenir les meilleures ventes de coffrets' })
//   getBestSellers(
//     @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
//     @Query('period') period?: string,
//   ) {
//     return this.coffretsService.getBestSellers(limit, period);
//   }

//   @Post(':id/image')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Uploader une image pour un coffret' })
//   @ApiConsumes('multipart/form-data')
//   @UseInterceptors(FileInterceptor('image'))
//   uploadImage(
//     @Param('id') id: string,
//     @UploadedFile() image: Express.Multer.File,
//   ) {
//     return this.coffretsService.uploadImage(id, image);
//   }

//   @Delete(':id/image')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Supprimer une image d\'un coffret' })
//   deleteImage(@Param('id') id: string, @Body() body: { imageUrl: string }) {
//     return this.coffretsService.deleteImage(id, body.imageUrl);
//   }

//   @Post('bulk/update')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Mettre à jour plusieurs coffrets' })
//   bulkUpdate(@Body() body: { ids: string[]; updateData: UpdateCoffretDto }) {
//     return this.coffretsService.bulkUpdate(body.ids, body.updateData);
//   }

//   @Post('bulk/delete')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Supprimer plusieurs coffrets' })
//   bulkDelete(@Body() body: { ids: string[] }) {
//     return this.coffretsService.bulkDelete(body.ids);
//   }

//   @Post(':id/duplicate')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Dupliquer un coffret' })
//   duplicate(
//     @Param('id') id: string,
//     @Body() body: { newName?: string },
//   ) {
//     return this.coffretsService.duplicate(id, body.newName);
//   }

//   @Get(':id/barcode')
//   @ApiOperation({ summary: 'Générer un code-barre pour le coffret' })
//   async generateBarcode(@Param('id') id: string, @Res() res: Response) {
//     const coffret = await this.coffretsService.findOne(id);
//     res.setHeader('Content-Type', 'image/png');
//     res.send(Buffer.from('fake-barcode-image-data'));
//   }

//   @Get(':id/label')
//   @ApiOperation({ summary: 'Générer une étiquette pour le coffret' })
//   async generateLabel(
//     @Param('id') id: string,
//     @Query('format') format: string = 'pdf',
//     @Res() res: Response,
//   ) {
//     const coffret = await this.coffretsService.findOne(id);
    
//     if (format === 'pdf') {
//       const doc = new (PDFDocument as any)({ size: 'A6', margin: 20 });
//       res.setHeader('Content-Type', 'application/pdf');
//       res.setHeader(
//         'Content-Disposition',
//         `attachment; filename="etiquette-coffret-${coffret.sku || coffret.id}.pdf"`
//       );
//       doc.pipe(res);
//       doc.fontSize(16).text(coffret.name, doc.x, doc.y, { align: 'center' });
//       doc.moveDown(0.5);
//       doc.fontSize(10).text(`SKU: ${coffret.sku || 'N/A'}`);
//       doc.text(`Thème: ${coffret.theme}`);
//       doc.text(`Type: ${coffret.type}`);
//       doc.text(`Prix: ${coffret.price.toFixed(2)} €`);
//       doc.text(`Stock: ${coffret.stock}`);
//       if (coffret.support) {
//         doc.moveDown(0.5);
//         doc.fontSize(12).text('Support:');
//         doc.fontSize(10).text(coffret.support.name);
//       }
//       if (coffret.items && (coffret.items as any[]).length > 0) {
//         doc.moveDown(1);
//         doc.fontSize(12).text('Produits inclus:');
//         (coffret.items as any[]).forEach((item: any, index: number) => {
//           doc.fontSize(10)
//             .text(`${index + 1}. ${item.product.name} x${item.quantity}`);
//         });
//       }
//       doc.moveDown(2);
//       doc.fontSize(8).text(`CODE: ${coffret.sku || coffret.id}`, doc.x, doc.y, { align: 'center' });
//       doc.end();
//     } else {
//       throw new BadRequestException('Format non supporté. Utilisez "pdf".');
//     }
//   }

//   @Get('export/csv')
//   @Roles(UserRole.ADMIN, UserRole.MANAGER)
//   @ApiOperation({ summary: 'Exporter les coffrets en CSV' })
//   async exportToCSV(@Res() res: Response) {
//     const { data: coffrets } = await this.coffretsService.findAll({
//       skip: 0,
//       take: 10000,
//       where: {},
//       orderBy: { name: 'asc' },
//     });

//     const tempFilePath = join(process.cwd(), 'temp-coffrets.csv');
//     const csvWriter = createObjectCsvWriter({
//       path: tempFilePath,
//       header: [
//         { id: 'sku', title: 'SKU' },
//         { id: 'name', title: 'Nom' },
//         { id: 'description', title: 'Description' },
//         { id: 'type', title: 'Type' },
//         { id: 'theme', title: 'Thème' },
//         { id: 'price', title: 'Prix' },
//         { id: 'cost', title: 'Coût' },
//         { id: 'margin', title: 'Marge' },
//         { id: 'stock', title: 'Stock' },
//         { id: 'minStock', title: 'Stock Min' },
//         { id: 'maxStock', title: 'Stock Max' },
//         { id: 'status', title: 'Statut' },
//         { id: 'createdAt', title: 'Date de création' },
//       ],
//     });

//     const records = coffrets.map((coffret: any) => ({
//       sku: coffret.sku || '',
//       name: coffret.name,
//       description: coffret.description || '',
//       type: coffret.type,
//       theme: coffret.theme,
//       price: coffret.price.toFixed(2),
//       cost: (coffret.cost || 0).toFixed(2),
//       margin: (coffret.margin || 0).toFixed(2),
//       stock: coffret.stock,
//       minStock: coffret.minStock || 5,
//       maxStock: coffret.maxStock || 50,
//       status: coffret.status,
//       createdAt: coffret.createdAt.toISOString(),
//     }));

//     await csvWriter.writeRecords(records);
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader(
//       'Content-Disposition',
//       'attachment; filename="coffrets-export.csv"'
//     );
//     const fileContent = readFileSync(tempFilePath);
//     res.send(fileContent);
//     unlinkSync(tempFilePath);
//   }

//   @Get(':id/validate-stock/:quantity')
//   @ApiOperation({ summary: 'Valider la disponibilité du stock' })
//   validateStockAvailability(
//     @Param('id') id: string,
//     @Param('quantity', ParseIntPipe) quantity: number,
//   ) {
//     return this.coffretsService.validateStockAvailability(id, quantity);
//   }

//   @Get(':id/margin')
//   @ApiOperation({ summary: 'Obtenir l\'analyse de marge du coffret' })
//   getMarginAnalysis(@Param('id') id: string) {
//     return this.coffretsService.getMarginAnalysis(id);
//   }
// }








import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  Res,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import * as PDFDocument from 'pdfkit';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { CoffretsService } from './coffrets.service';
import { CreateCoffretDto } from './dto/create-coffret.dto';
import { UpdateCoffretDto } from './dto/update-coffret.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Express } from 'express';

@ApiTags('coffrets')
@ApiBearerAuth()
@Controller('coffrets')
export class CoffretsController {
  constructor(private readonly coffretsService: CoffretsService) {}

  // === ROUTES PUBLIQUES ===
  @Get()
  @ApiOperation({ summary: 'Récupérer tous les coffrets' })
  @ApiResponse({ status: 200, description: 'Liste des coffrets' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('theme') theme?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minStock') minStock?: string,
    @Query('maxStock') maxStock?: string,
  ) {
    const skip = (page - 1) * limit;
    let where: any = {};
    if (theme) where.theme = theme;
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (minStock || maxStock) {
      where.stock = {};
      if (minStock) where.stock.gte = parseInt(minStock);
      if (maxStock) where.stock.lte = parseInt(maxStock);
    }
    return this.coffretsService.findAll({ skip, take: limit, where, orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un coffret par ID' })
  @ApiResponse({ status: 200, description: 'Coffret trouvé' })
  @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
  findOne(@Param('id') id: string) {
    return this.coffretsService.findOne(id);
  }

  @Get('search/:query')
  @ApiOperation({ summary: 'Rechercher des coffrets' })
  search(@Param('query') query: string) {
    return this.coffretsService.search(query);
  }

  @Get('theme/:theme')
  @ApiOperation({ summary: 'Filtrer les coffrets par thème' })
  findByTheme(@Param('theme') theme: string) {
    return this.coffretsService.findByTheme(theme);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Filtrer les coffrets par type' })
  findByType(@Param('type') type: string) {
    return this.coffretsService.findByType(type);
  }

  // === ROUTES PROTÉGÉES ===
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer un nouveau coffret' })
  @ApiResponse({ status: 201, description: 'Coffret créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Nom de coffret déjà utilisé' })
  create(@Body() createCoffretDto: CreateCoffretDto) {
    return this.coffretsService.create(createCoffretDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un coffret' })
  @ApiResponse({ status: 200, description: 'Coffret mis à jour' })
  @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
  @ApiResponse({ status: 409, description: 'Nom de coffret déjà utilisé' })
  update(@Param('id') id: string, @Body() updateCoffretDto: UpdateCoffretDto) {
    return this.coffretsService.update(id, updateCoffretDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Supprimer un coffret' })
  @ApiResponse({ status: 200, description: 'Coffret supprimé' })
  @ApiResponse({ status: 404, description: 'Coffret non trouvé' })
  remove(@Param('id') id: string) {
    return this.coffretsService.remove(id);
  }

  @Put(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  @ApiOperation({ summary: 'Mettre à jour le stock d\'un coffret' })
  updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.coffretsService.updateStock(id, quantity);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  @ApiOperation({ summary: 'Réserver du stock pour un coffret' })
  reserveStock(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.coffretsService.reserveStock(id, body.quantity);
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCKISTE)
  @ApiOperation({ summary: 'Libérer du stock réservé pour un coffret' })
  releaseStock(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.coffretsService.releaseStock(id, body.quantity);
  }

  @Get('low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Récupérer les coffrets en faible stock' })
  findLowStock(@Query('threshold') threshold: string) {
    return this.coffretsService.findLowStock(threshold ? parseInt(threshold) : undefined);
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Obtenir les statistiques des coffrets' })
  getStats() {
    return this.coffretsService.getStats();
  }

  @Get('stats/best-sellers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Obtenir les meilleures ventes de coffrets' })
  getBestSellers(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, @Query('period') period?: string) {
    return this.coffretsService.getBestSellers(limit, period);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Uploader une image pour un coffret' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  uploadImage(@Param('id') id: string, @UploadedFile() image: Express.Multer.File) {
    return this.coffretsService.uploadImage(id, image);
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Supprimer une image d\'un coffret' })
  deleteImage(@Param('id') id: string, @Body() body: { imageUrl: string }) {
    return this.coffretsService.deleteImage(id, body.imageUrl);
  }

  @Post('bulk/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour plusieurs coffrets' })
  bulkUpdate(@Body() body: { ids: string[]; updateData: UpdateCoffretDto }) {
    return this.coffretsService.bulkUpdate(body.ids, body.updateData);
  }

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Supprimer plusieurs coffrets' })
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.coffretsService.bulkDelete(body.ids);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Dupliquer un coffret' })
  duplicate(@Param('id') id: string, @Body() body: { newName?: string }) {
    return this.coffretsService.duplicate(id, body.newName);
  }

  @Get(':id/barcode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Générer un code-barre pour le coffret' })
  async generateBarcode(@Param('id') id: string, @Res() res: Response) {
    const coffret = await this.coffretsService.findOne(id);
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from('fake-barcode-image-data'));
  }

  @Get(':id/label')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Générer une étiquette pour le coffret' })
  async generateLabel(@Param('id') id: string, @Query('format') format: string = 'pdf', @Res() res: Response) {
    const coffret = await this.coffretsService.findOne(id);
    if (format === 'pdf') {
      const doc = new (PDFDocument as any)({ size: 'A6', margin: 20 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="etiquette-coffret-${coffret.sku || coffret.id}.pdf"`);
      doc.pipe(res);
      doc.fontSize(16).text(coffret.name, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`SKU: ${coffret.sku || 'N/A'}`);
      doc.text(`Thème: ${coffret.theme}`);
      doc.text(`Type: ${coffret.type}`);
      doc.text(`Prix: ${coffret.price.toFixed(2)} €`);
      doc.text(`Stock: ${coffret.stock}`);
      if (coffret.support) {
        doc.moveDown(0.5);
        doc.fontSize(12).text('Support:');
        doc.fontSize(10).text(coffret.support.name);
      }
      if (coffret.items && (coffret.items as any[]).length > 0) {
        doc.moveDown(1);
        doc.fontSize(12).text('Produits inclus:');
        (coffret.items as any[]).forEach((item: any, index: number) => {
          doc.fontSize(10).text(`${index + 1}. ${item.product.name} x${item.quantity}`);
        });
      }
      doc.moveDown(2);
      doc.fontSize(8).text(`CODE: ${coffret.sku || coffret.id}`, { align: 'center' });
      doc.end();
    } else {
      throw new BadRequestException('Format non supporté. Utilisez "pdf".');
    }
  }

  @Get('export/csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Exporter les coffrets en CSV' })
  async exportToCSV(@Res() res: Response) {
    const { data: coffrets } = await this.coffretsService.findAll({
      skip: 0,
      take: 10000,
      where: {},
      orderBy: { name: 'asc' },
    });
    const tempFilePath = join(process.cwd(), 'temp-coffrets.csv');
    const csvWriter = createObjectCsvWriter({
      path: tempFilePath,
      header: [
        { id: 'sku', title: 'SKU' },
        { id: 'name', title: 'Nom' },
        { id: 'description', title: 'Description' },
        { id: 'type', title: 'Type' },
        { id: 'theme', title: 'Thème' },
        { id: 'price', title: 'Prix' },
        { id: 'cost', title: 'Coût' },
        { id: 'margin', title: 'Marge' },
        { id: 'stock', title: 'Stock' },
        { id: 'minStock', title: 'Stock Min' },
        { id: 'maxStock', title: 'Stock Max' },
        { id: 'status', title: 'Statut' },
        { id: 'createdAt', title: 'Date de création' },
      ],
    });
    const records = coffrets.map((coffret: any) => ({
      sku: coffret.sku || '',
      name: coffret.name,
      description: coffret.description || '',
      type: coffret.type,
      theme: coffret.theme,
      price: coffret.price.toFixed(2),
      cost: (coffret.cost || 0).toFixed(2),
      margin: (coffret.margin || 0).toFixed(2),
      stock: coffret.stock,
      minStock: coffret.minStock || 5,
      maxStock: coffret.maxStock || 50,
      status: coffret.status,
      createdAt: coffret.createdAt.toISOString(),
    }));
    await csvWriter.writeRecords(records);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="coffrets-export.csv"');
    const fileContent = readFileSync(tempFilePath);
    res.send(fileContent);
    unlinkSync(tempFilePath);
  }

  @Get(':id/validate-stock/:quantity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Valider la disponibilité du stock' })
  validateStockAvailability(@Param('id') id: string, @Param('quantity', ParseIntPipe) quantity: number) {
    return this.coffretsService.validateStockAvailability(id, quantity);
  }

  @Get(':id/margin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Obtenir l\'analyse de marge du coffret' })
  getMarginAnalysis(@Param('id') id: string) {
    return this.coffretsService.getMarginAnalysis(id);
  }
}