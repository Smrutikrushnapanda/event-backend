import { Body, Controller, Param, Post } from '@nestjs/common';
import { UniversalCheckInService } from './universal-checkin.service';
import { IsIn, IsString } from 'class-validator';

class UniversalCheckInDto {
  @IsIn(['entry', 'lunch', 'dinner', 'session'])
  type: 'entry' | 'lunch' | 'dinner' | 'session';
  
  @IsString()
  scannedBy: string;
}

@Controller('universal-checkin')
export class UniversalCheckInController {
  constructor(private readonly service: UniversalCheckInService) {}

  // ✅ FIXED: Changed to POST method
  @Post(':qrCode/lookup')
  async lookup(@Param('qrCode') qrCode: string) {
    console.log('📋 Lookup request for QR:', qrCode);
    return this.service.universalLookup(qrCode);
  }

  // ✅ Existing check-in endpoint
  @Post(':qrCode')
  async checkIn(
    @Param('qrCode') qrCode: string,
    @Body() dto: UniversalCheckInDto,
  ) {
    console.log('✅ Check-in request for QR:', qrCode, 'Type:', dto.type);
    return this.service.universalCheckIn(qrCode, dto.type, dto.scannedBy);
  }
}