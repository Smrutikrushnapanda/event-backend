import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { UniversalCheckInService } from './universal-checkin.service';
import { IsIn, IsString } from 'class-validator';

// ✅ ADD VALIDATION
export class UniversalCheckInDto {
  @IsIn(['entry', 'lunch', 'dinner', 'session'])
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @IsString()
  scannedBy: string;
}

@ApiTags('Universal Check-In')
@Controller('universal-checkin')
export class UniversalCheckInController {
  constructor(private readonly checkInService: UniversalCheckInService) {}

  @Post(':qrCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🎫 Universal QR Code Check-In',
    description: 'Works for both farmer registrations and guest passes',
  })
  @ApiParam({
    name: 'qrCode',
    description: 'QR code from either farmer or guest pass',
    example: 'DELEGATE-001',
  })
  @ApiBody({
    type: UniversalCheckInDto,
    examples: {
      entry: {
        summary: 'Entry Check-In',
        value: {
          type: 'entry',
          scannedBy: 'Volunteer-1',
        },
      },
      lunch: {
        summary: 'Lunch Check-In',
        value: {
          type: 'lunch',
          scannedBy: 'Volunteer-1',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Check-in processed' })
  @ApiResponse({ status: 404, description: 'QR code not found' })
  async universalCheckIn(
    @Param('qrCode') qrCode: string,
    @Body() dto: UniversalCheckInDto,
  ) {
    return this.checkInService.universalCheckIn(
      qrCode,
      dto.type,
      dto.scannedBy,
    );
  }
}