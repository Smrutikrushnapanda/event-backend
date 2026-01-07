import { IsNotEmpty, IsMobilePhone, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddDelegateDto {

  @ApiProperty({ example: 'Jane Doe', description: 'Delegate full name' })
  @IsNotEmpty()
  @IsString()
  delegateName: string;

  @ApiProperty({ example: '9876543210', description: 'Delegate mobile number' })
  @IsMobilePhone('en-IN')
  delegateMobile: string;

  @ApiPropertyOptional({ example: '/uploads/delegate-123.jpg', description: 'Delegate photo URL' })
  @IsOptional()
  @IsString()
  delegatePhotoUrl?: string;
}