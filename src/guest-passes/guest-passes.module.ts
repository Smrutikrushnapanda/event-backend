import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestPassesController } from './guest-passes.controller';
import { GuestPassesService } from './guest-passes.service';
import { GuestExportService } from './guest-export.service';
import { GuestPDFService } from './guest-pdf.service';
import { GuestPass } from './entities/guest-pass.entity';
import { GuestCheckIn } from './entities/guest-checkin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GuestPass, GuestCheckIn])],
  controllers: [GuestPassesController],
  providers: [GuestPassesService, GuestExportService, GuestPDFService],
  exports: [GuestPassesService],
})
export class GuestPassesModule {}