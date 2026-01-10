import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestCheckInDto {
  @ApiProperty({
    description: 'Check-in type',
    enum: ['entry', 'lunch', 'dinner', 'session'],
    example: 'entry',
  })
  @IsEnum(['entry', 'lunch', 'dinner', 'session'])
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @ApiProperty({
    description: 'Who scanned the QR code',
    example: 'Volunteer-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  scannedBy?: string;
}