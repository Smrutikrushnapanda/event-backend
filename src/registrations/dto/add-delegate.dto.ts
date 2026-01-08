import { IsString, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddDelegateDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Delegate full name' })
  @IsString()
  @IsNotEmpty({ message: 'Delegate name is required' })
  delegateName: string;

  @ApiProperty({ example: '9876543210', description: 'Delegate mobile number' })
  @IsString()
  @IsNotEmpty({ message: 'Delegate mobile number is required' })
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  delegateMobile: string;

  @ApiPropertyOptional({ example: '/uploads/delegate-123.jpg', description: 'Delegate photo URL' })
  @IsOptional()
  @IsString()
  delegatePhotoUrl?: string;
}