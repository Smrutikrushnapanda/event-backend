import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { ExcelExportService } from './excel-export.service';
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
  ],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}