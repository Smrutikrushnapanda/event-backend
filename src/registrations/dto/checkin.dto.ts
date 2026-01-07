import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInType } from '../entities/checkin.entity';

export class CheckInDto {

  @ApiProperty({ 
    enum: CheckInType, 
    example: CheckInType.ENTRY,
    description: 'Type of check-in (ENTRY, LUNCH, DINNER, EXIT)' 
  })
  @IsEnum(CheckInType)
  type: CheckInType;

  @ApiPropertyOptional({ example: 'Volunteer John', description: 'Name of person who scanned' })
  @IsOptional()
  @IsString()
  scannedBy?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether delegate attended instead' })
  @IsOptional()
  @IsBoolean()
  wasDelegate?: boolean;
}