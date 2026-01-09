import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { ExcelExportService } from './excel-export.service';
import { QRCodePDFService } from './qrcode-pdf.service';
import { RegistrationCacheService } from './registration-cache.service'; // ADD THIS
import { Registration } from './entities/registrations.entity';
import { CheckIn } from './entities/checkin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Registration, CheckIn]),
  ],
  controllers: [RegistrationsController],
  providers: [
    RegistrationsService,
    ExcelExportService,
    QRCodePDFService,
    RegistrationCacheService,  // ADD THIS LINE
  ],
  exports: [
    RegistrationsService,
    RegistrationCacheService,  // ADD THIS LINE
  ],
})
export class RegistrationsModule {}