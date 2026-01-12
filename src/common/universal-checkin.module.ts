import { Module } from '@nestjs/common';
import { UniversalCheckinController } from './universal-checkin.controller';
import { RegistrationsModule } from '../registrations/registrations.module';
import { GuestPassesModule } from '../guest-passes/guest-passes.module';

@Module({
  imports: [
    RegistrationsModule,
    GuestPassesModule,
  ],
  controllers: [UniversalCheckinController],
})
export class UniversalCheckinModule {}