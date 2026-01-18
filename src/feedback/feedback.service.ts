import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackQuestion } from './entities/feedback-question.entity';
import { FeedbackResponse } from './entities/feedback-response.entity';
import {
  CreateFeedbackQuestionDto,
  UpdateFeedbackQuestionDto,
  SubmitFeedbackDto,
  BulkSubmitFeedbackDto,
} from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackQuestion)
    private questionRepository: Repository<FeedbackQuestion>,
    @InjectRepository(FeedbackResponse)
    private responseRepository: Repository<FeedbackResponse>,
  ) {}

  // ============================================
  // ADMIN - Question Management
  // ============================================

  async createQuestion(dto: CreateFeedbackQuestionDto): Promise<FeedbackQuestion> {
    const question = this.questionRepository.create({
      ...dto,
      order: dto.order ?? 0,
    });
    return this.questionRepository.save(question);
  }

  async getAllQuestions(includeInactive = false): Promise<FeedbackQuestion[]> {
    const query = this.questionRepository
      .createQueryBuilder('question')
      .orderBy('question.order', 'ASC')
      .addOrderBy('question.createdAt', 'ASC');

    if (!includeInactive) {
      query.andWhere('question.isActive = :isActive', { isActive: true });
    }

    return query.getMany();
  }

  async getQuestionById(id: string): Promise<FeedbackQuestion> {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  async updateQuestion(
    id: string,
    dto: UpdateFeedbackQuestionDto,
  ): Promise<FeedbackQuestion> {
    const question = await this.getQuestionById(id);
    Object.assign(question, dto);
    return this.questionRepository.save(question);
  }

  async deleteQuestion(id: string): Promise<void> {
    const question = await this.getQuestionById(id);
    await this.questionRepository.remove(question);
  }

  async reorderQuestions(orders: { id: string; order: number }[]): Promise<void> {
    for (const item of orders) {
      await this.questionRepository.update(item.id, { order: item.order });
    }
  }

  // ============================================
  // PUBLIC - Get Active Questions
  // ============================================

  async getActiveQuestions(): Promise<FeedbackQuestion[]> {
    return this.questionRepository.find({
      where: { isActive: true },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  // ============================================
  // PUBLIC - Submit Feedback
  // ============================================

  async submitFeedback(
    dto: SubmitFeedbackDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<FeedbackResponse> {
    const question = await this.getQuestionById(dto.questionId);

    const response = this.responseRepository.create({
      questionId: dto.questionId,
      rating: dto.rating,
      comment: dto.comment,
      ipAddress,
      userAgent,
    });

    return this.responseRepository.save(response);
  }

  async bulkSubmitFeedback(
    dto: BulkSubmitFeedbackDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ submitted: number; responses: FeedbackResponse[] }> {
    const responses: FeedbackResponse[] = [];

    for (const item of dto.responses) {
      const response = await this.submitFeedback(item, ipAddress, userAgent);
      responses.push(response);
    }

    return {
      submitted: responses.length,
      responses,
    };
  }

  // ============================================
  // ADMIN - Analytics
  // ============================================

  async getQuestionStatistics(questionId: string): Promise<any> {
    const question = await this.getQuestionById(questionId);

    const responses = await this.responseRepository.find({
      where: { questionId },
    });

    const totalResponses = responses.length;
    const ratings = [1, 2, 3, 4, 5].map((rating) => {
      const count = responses.filter((r) => r.rating === rating).length;
      return {
        rating,
        count,
        percentage: totalResponses > 0 ? ((count / totalResponses) * 100).toFixed(1) : '0',
      };
    });

    const averageRating =
      totalResponses > 0
        ? (responses.reduce((sum, r) => sum + r.rating, 0) / totalResponses).toFixed(2)
        : '0';

    return {
      question,
      totalResponses,
      averageRating,
      ratings,
      recentComments: responses
        .filter((r) => r.comment)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((r) => ({
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
    };
  }

  async getAllStatistics(): Promise<any> {
    const questions = await this.getAllQuestions(false);
    const statistics = await Promise.all(
      questions.map((q) => this.getQuestionStatistics(q.id)),
    );

    const totalResponses = statistics.reduce((sum, s) => sum + s.totalResponses, 0);
    const overallAverage =
      statistics.length > 0
        ? (
            statistics.reduce((sum, s) => sum + parseFloat(s.averageRating), 0) /
            statistics.length
          ).toFixed(2)
        : '0';

    return {
      totalQuestions: questions.length,
      totalResponses,
      overallAverage,
      questionStats: statistics,
    };
  }
}