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
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  Request
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { HelpfulReviewDto } from './dto/helpful-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Post(':id/helpful')
  @HttpCode(HttpStatus.OK)
  async markAsHelpful(
    @Param('id') id: string, // Enlevé ParseUUIDPipe
    @Body() helpfulDto: HelpfulReviewDto,
  ) {
    return this.reviewsService.markAsHelpful(id, helpfulDto);
  }

  @Get('product/:productId')
  async findAllByProduct(
    @Param('productId') productId: string, // Enlevé ParseUUIDPipe
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findAllByProduct(productId, query);
  }

  @Get('product/:productId/stats')
  async getProductStats(@Param('productId') productId: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.getProductStats(productId);
  }

  @Get('product/:productId/summary')
  async getProductSummary(@Param('productId') productId: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.getProductReviewSummary(productId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.findOne(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findAll(@Query() query: ReviewQueryDto) {
    return this.reviewsService.findAllByProduct('', query);
  }

  @Get('user/my-reviews')
  @UseGuards(JwtAuthGuard)
  async getUserReviews(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.getUserReviews(req.user.id, page, limit);
  }

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getDashboardStats() {
    return this.reviewsService.getDashboardStats();
  }

  @Get('recent')
  async getRecentReviews(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.reviewsService.getRecentReviews(limit);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string, // Enlevé ParseUUIDPipe
    @Body() updateReviewDto: UpdateReviewDto,
    @Request() req,
  ) {
    return this.reviewsService.update(id, updateReviewDto, req.user.id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async approveReview(@Param('id') id: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.approveReview(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async rejectReview(@Param('id') id: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.rejectReview(id);
  }

  @Patch('batch/update-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async batchUpdateStatus(
    @Body('ids') ids: string[],
    @Body('status') status: string,
  ) {
    return this.reviewsService.batchUpdateStatus(ids, status as any);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string, // Enlevé ParseUUIDPipe
    @Request() req,
  ) {
    return this.reviewsService.remove(id, req.user.id);
  }

  @Delete(':id/force')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async forceRemove(@Param('id') id: string) { // Enlevé ParseUUIDPipe
    return this.reviewsService.remove(id);
  }
}