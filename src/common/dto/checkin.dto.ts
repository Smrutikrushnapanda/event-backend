import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ 
    description: 'Type of check-in',
    enum: ['entry', 'lunch', 'dinner', 'session'],
    example: 'entry'
  })
  @IsString()
  @IsEnum(['entry', 'lunch', 'dinner', 'session'])
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @ApiProperty({ 
    description: 'ID of volunteer who performed the scan',
    example: 'volunteer-uuid-123'
  })
  @IsString()
  scannedBy: string;

  @ApiPropertyOptional({ 
    description: 'Whether this check-in is for a behalf person',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  wasBehalf?: boolean;

  @ApiPropertyOptional({ 
    description: 'Name of behalf person (required if wasBehalf is true)',
    example: 'Ravi Kumar'
  })
  @IsOptional()
  @IsString()
  behalfName?: string;

  @ApiPropertyOptional({ 
    description: 'Mobile of behalf person (required if wasBehalf is true)',
    example: '9876543210'
  })
  @IsOptional()
  @IsString()
  behalfMobile?: string;

  @ApiPropertyOptional({ 
    description: 'Gender of behalf person (required if wasBehalf is true)',
    enum: ['male', 'female', 'others'],
    example: 'male'
  })
  @IsOptional()
  @IsEnum(['male', 'female', 'others'])
  behalfGender?: 'male' | 'female' | 'others';
}

export class EditCheckInDto {
  @ApiProperty({ 
    description: 'New check-in type (cannot change to/from entry)',
    enum: ['lunch', 'dinner', 'session'],
    example: 'dinner'
  })
  @IsString()
  @IsEnum(['lunch', 'dinner', 'session'])
  newType: 'lunch' | 'dinner' | 'session';

  @ApiProperty({ 
    description: 'ID of volunteer who edited',
    example: 'volunteer-uuid-456'
  })
  @IsString()
  editedBy: string;
}