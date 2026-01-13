import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniversalCheckinController } from './universal-checkin.controller';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';
import { RegistrationsModule } from '../registrations/registrations.module';
import { GuestPassesModule } from '../guest-passes/guest-passes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Registration, CheckIn, GuestPass, GuestCheckIn]),
    RegistrationsModule,
    GuestPassesModule,
  ],
  controllers: [UniversalCheckinController],
})
export class UniversalCheckinModule {}