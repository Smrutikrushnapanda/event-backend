import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniversalCheckInController } from './universal-checkin.controller';
import { UniversalCheckInService } from './universal-checkin.service';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Registration,
      CheckIn,
      GuestPass,
      GuestCheckIn,
    ]),
  ],
  controllers: [UniversalCheckInController],
  providers: [UniversalCheckInService],
  exports: [UniversalCheckInService],
})
export class UniversalCheckInModule {}