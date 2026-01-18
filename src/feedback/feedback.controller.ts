import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeedbackService } from './feedback.service';
import {
  CreateFeedbackQuestionDto,
  UpdateFeedbackQuestionDto,
  BulkSubmitFeedbackDto,
} from './dto/feedback.dto';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // ============================================
  // PUBLIC ROUTES
  // ============================================

  @Get('questions')
  @ApiOperation({ summary: '📋 Get all active feedback questions' })
  async getActiveQuestions() {
    return this.feedbackService.getActiveQuestions();
  }

  @Post('submit')
  @ApiOperation({ summary: '⭐ Submit feedback responses' })
  async submitFeedback(@Body() dto: BulkSubmitFeedbackDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.feedbackService.bulkSubmitFeedback(dto, ipAddress, userAgent);
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  @Get('admin/questions')
  @ApiOperation({ summary: '🔧 [ADMIN] Get all questions' })
  async getAllQuestions(@Query('includeInactive') includeInactive?: string) {
    return this.feedbackService.getAllQuestions(includeInactive === 'true');
  }

  @Post('admin/questions')
  @ApiOperation({ summary: '➕ [ADMIN] Create new question' })
  async createQuestion(@Body() dto: CreateFeedbackQuestionDto) {
    return this.feedbackService.createQuestion(dto);
  }

  @Get('admin/questions/:id')
  @ApiOperation({ summary: '🔍 [ADMIN] Get question by ID' })
  async getQuestionById(@Param('id') id: string) {
    return this.feedbackService.getQuestionById(id);
  }

  @Put('admin/questions/:id')
  @ApiOperation({ summary: '✏️ [ADMIN] Update question' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackQuestionDto,
  ) {
    return this.feedbackService.updateQuestion(id, dto);
  }

  @Delete('admin/questions/:id')
  @ApiOperation({ summary: '🗑️ [ADMIN] Delete question' })
  async deleteQuestion(@Param('id') id: string) {
    await this.feedbackService.deleteQuestion(id);
    return { message: 'Question deleted successfully' };
  }

  @Post('admin/questions/reorder')
  @ApiOperation({ summary: '🔄 [ADMIN] Reorder questions' })
  async reorderQuestions(@Body() orders: { id: string; order: number }[]) {
    await this.feedbackService.reorderQuestions(orders);
    return { message: 'Questions reordered successfully' };
  }

  @Get('admin/statistics')
  @ApiOperation({ summary: '📊 [ADMIN] Get all statistics' })
  async getAllStatistics() {
    return this.feedbackService.getAllStatistics();
  }

  @Get('admin/statistics/:questionId')
  @ApiOperation({ summary: '📊 [ADMIN] Get question statistics' })
  async getQuestionStatistics(@Param('questionId') questionId: string) {
    return this.feedbackService.getQuestionStatistics(questionId);
  }
}