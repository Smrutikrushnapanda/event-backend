import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackQuestion } from './entities/feedback-question.entity';
import { FeedbackResponse } from './entities/feedback-response.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackQuestion, FeedbackResponse])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}