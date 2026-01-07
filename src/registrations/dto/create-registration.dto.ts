import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateRegistrationDto {

  @ApiProperty({ example: 'John Doe', description: 'Full name of the registrant' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'Bhubaneswar', description: 'Village name' })
  @IsString()
  @IsNotEmpty({ message: 'Village is required' })
  @Transform(({ value }) => value?.trim())
  village: string;

  @ApiProperty({ example: 'Bhubaneswar GP', description: 'Gram Panchayat' })
  @IsString()
  @IsNotEmpty({ message: 'GP is required' })
  @Transform(({ value }) => value?.trim())
  gp: string;

  @ApiProperty({ example: 'Khordha', description: 'District name' })
  @IsString()
  @IsNotEmpty({ message: 'District is required' })
  district: string;

  @ApiProperty({ example: 'Bhubaneswar', description: 'Block name' })
  @IsString()
  @IsNotEmpty({ message: 'Block is required' })
  block: string;

  @ApiProperty({ example: '9876543210', description: '10-digit mobile number' })
  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile: string;

  @ApiProperty({ example: '123456789012', description: '12-digit Aadhaar number' })
  @IsString()
  @IsNotEmpty({ message: 'Aadhaar number is required' })
  @Length(12, 12, { message: 'Aadhaar number must be exactly 12 digits' })
  @Matches(/^\d{12}$/, { message: 'Aadhaar must contain only digits' })
  aadhaarOrId: string;

  @ApiPropertyOptional({ example: '/uploads/photo-123.jpg', description: 'Photo URL' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ example: 'Fisheries & Animal Resources Development', description: 'Category or Department' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;
}