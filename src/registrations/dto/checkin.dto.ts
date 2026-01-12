import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ 
    description: 'Type of check-in',
    enum: ['entry', 'lunch', 'dinner', 'session'],
    example: 'entry'
  })
  @IsString()
  @IsEnum(['entry', 'lunch', 'dinner', 'session'])
  type: string;

  @ApiProperty({ 
    description: 'ID of volunteer who performed the scan',
    example: 'volunteer-uuid-123'
  })
  @IsString()
  scannedBy: string;

  @ApiProperty({ 
    description: 'Whether this check-in is for a person attending on behalf of the registered farmer',
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  wasBehalf?: boolean;
}