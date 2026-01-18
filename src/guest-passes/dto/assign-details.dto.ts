import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignDetailsDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the guest' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '9876543210', description: 'Mobile number (optional)' })
  @IsString()
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile must be a valid 10-digit Indian number',
  })
  mobile?: string;

  @ApiPropertyOptional({ example: 'Chief Executive Officer', description: 'Designation (optional)' })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional({ example: 'Admin', description: 'Person who assigned' })
  @IsString()
  @IsOptional()
  assignedBy?: string;
}