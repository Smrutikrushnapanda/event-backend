import { IsString, IsInt, Min, Max, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFeedbackQuestionDto {
  @ApiProperty({ example: 'How would you rate the event organization?' })
  @IsString()
  questionEnglish: string;

  @ApiProperty({ example: 'ଇଭେଣ୍ଟ ସଂଗଠନକୁ ଆପଣ କିପରି ମୂଲ୍ୟାଙ୍କନ କରିବେ?' })
  @IsString()
  questionOdia: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateFeedbackQuestionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  questionEnglish?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  questionOdia?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubmitFeedbackDto {
  @ApiProperty({ example: 'uuid-of-question' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Great event!', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkSubmitFeedbackDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ type: [SubmitFeedbackDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitFeedbackDto)
  responses: SubmitFeedbackDto[];
}