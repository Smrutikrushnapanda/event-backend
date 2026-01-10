import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  // ✅ NEW: Lookup without check-in
  @Get(':qrCode/lookup')
  async lookup(@Param('qrCode') qrCode: string) {
    return this.service.universalLookup(qrCode);
  }

  // ✅ Existing check-in endpoint
  @Post(':qrCode')
  async checkIn(
    @Param('qrCode') qrCode: string,
    @Body() dto: UniversalCheckInDto,
  ) {
    return this.service.universalCheckIn(qrCode, dto.type, dto.scannedBy);
  }
}