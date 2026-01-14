// dto/update-registration.dto.ts
import {
  IsOptional,
  IsString,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateRegistrationDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({ example: 'Bhubaneswar', description: 'Village name', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  village?: string;

  @ApiProperty({ example: 'Khordha', description: 'District name', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Bhubaneswar', description: 'Block name', required: false })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ example: '9876543210', description: '10-digit mobile', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile?: string;

  @ApiProperty({ example: '123456789012', description: '12-digit Aadhaar', required: false })
  @IsOptional()
  @IsString()
  @Length(12, 12, { message: 'Aadhaar number must be exactly 12 digits' })
  @Matches(/^\d{12}$/, { message: 'Aadhaar must contain only digits' })
  aadhaarOrId?: string;

  @ApiProperty({ 
    example: 'male', 
    description: 'Gender',
    enum: ['male', 'female', 'others'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['male', 'female', 'others'], { message: 'Gender must be male, female, or others' })
  gender?: 'male' | 'female' | 'others';

  @ApiProperty({ 
    example: 'general', 
    description: 'Caste category',
    enum: ['general', 'obc', 'sc', 'st'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['general', 'obc', 'sc', 'st'], { message: 'Caste must be general, obc, sc, or st' })
  caste?: 'general' | 'obc' | 'sc' | 'st';

  @ApiProperty({ 
    example: 'Fisheries & Animal Resources Development', 
    description: 'Category or Department',
    required: false 
  })
  @IsOptional()
  @IsString()
  category?: string;
}