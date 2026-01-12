import { Controller, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UniversalCheckInService } from './universal-checkin.service';

class CheckInDto {
  type: 'entry' | 'lunch' | 'dinner' | 'session';
  scannedBy?: string;
  wasDelegate?: boolean;
}

@ApiTags('Universal Check-in')
@Controller('universal-checkin')
export class UniversalCheckInController {
  constructor(private readonly service: UniversalCheckInService) {}

  @Post(':qrCode/lookup')
  @ApiOperation({ summary: '🔍 Lookup attendee (Farmer or Guest) without check-in' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0' })
  @ApiResponse({ status: 200, description: 'Attendee found' })
  @ApiResponse({ status: 404, description: 'QR Code not found' })
  async lookup(@Param('qrCode') qrCode: string) {
    return this.service.lookupAttendee(qrCode);
  }

  @Post(':qrCode')
  @ApiOperation({ summary: '✅ Universal check-in (works for both Farmers and Guests)' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0' })
  @ApiResponse({ status: 200, description: 'Check-in successful' })
  @ApiResponse({ status: 404, description: 'QR Code not found' })
  async checkIn(@Param('qrCode') qrCode: string, @Body() dto: CheckInDto) {
    return this.service.checkInAttendee(qrCode, dto.type, dto.scannedBy, dto.wasDelegate);
  }
}