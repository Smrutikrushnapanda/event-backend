import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
  Logger,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';
import { CheckInDto, EditCheckInDto } from './dto/checkin.dto';

@ApiTags('Universal Check-in')
@Controller('universal-checkin')
export class UniversalCheckinController {
  private readonly logger = new Logger(UniversalCheckinController.name);

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(GuestCheckIn)
    private guestCheckInRepository: Repository<GuestCheckIn>,
  ) {}

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * Get today's check-in status for a farmer
   */
  private async getFarmerTodayStatus(farmerId: string, today: string) {
    const checkIns = await this.checkInRepository.find({
      where: {
        registrationId: farmerId,
        checkInDate: today as any,
      },
    });

    return {
      hasEntry: checkIns.some(c => c.type === 'entry'),
      hasLunch: checkIns.some(c => c.type === 'lunch'),
      hasDinner: checkIns.some(c => c.type === 'dinner'),
      hasSession: checkIns.some(c => c.type === 'session'),
      checkIns,
    };
  }

  /**
   * Get today's check-in status for a guest
   */
  private async getGuestTodayStatus(guestId: string, today: string) {
    const checkIns = await this.guestCheckInRepository.find({
      where: {
        guestPassId: guestId,
        checkInDate: today as any,
      },
    });

    return {
      hasEntry: checkIns.some(c => c.type === 'entry'),
      hasLunch: checkIns.some(c => c.type === 'lunch'),
      hasDinner: checkIns.some(c => c.type === 'dinner'),
      hasSession: checkIns.some(c => c.type === 'session'),
      checkIns,
    };
  }

  // ✅ LOOKUP ENDPOINT (Gets today's status)
  @Post(':qrCode/lookup')
  @ApiOperation({ 
    summary: 'Lookup attendee by QR code',
    description: 'Returns attendee info with TODAY\'s check-in status'
  })
  async universalLookup(@Param('qrCode') qrCode: string) {
    this.logger.log(`🔍 Lookup: ${qrCode}`);
    const today = this.getTodayDate();

    // Try farmer first
    const farmer = await this.registrationRepository.findOne({
      where: { qrCode },
    });
    
    if (farmer) {
      const status = await this.getFarmerTodayStatus(farmer.id, today);
      
      return {
        success: true,
        message: 'Farmer found',
        type: 'farmer',
        attendeeType: 'FARMER',
        data: {
          id: farmer.id,
          name: farmer.name,
          mobile: farmer.mobile,
          village: farmer.village,
          block: farmer.block,
          district: farmer.district,
          category: farmer.category,
          gender: farmer.gender,
          qrCode: farmer.qrCode,
          behalfName: farmer.behalfName,
          behalfMobile: farmer.behalfMobile,
          behalfGender: farmer.behalfGender,
          isBehalfAttending: farmer.isBehalfAttending,
          // ✅ TODAY'S STATUS
          hasCheckedIn: {
            entry: status.hasEntry,
            lunch: status.hasLunch,
            dinner: status.hasDinner,
            session: status.hasSession,
          },
          todaysCheckIns: status.checkIns.map(c => ({
            id: c.id,
            type: c.type,
            scannedAt: c.scannedAt,
            scannedBy: c.scannedBy,
            wasBehalf: c.wasBehalf,
            wasEdited: c.wasEdited,
            originalType: c.originalType,
          })),
        },
      };
    }

    // Try guest
    const guest = await this.guestPassRepository.findOne({
      where: { qrCode },
    });
    
    if (guest) {
      const status = await this.getGuestTodayStatus(guest.id, today);
      
      return {
        success: true,
        message: guest.isAssigned ? 'Guest found' : 'Unassigned guest pass',
        type: 'guest',
        attendeeType: 'GUEST',
        data: {
          id: guest.id,
          name: guest.name,
          mobile: guest.mobile,
          category: guest.category,
          qrCode: guest.qrCode,
          isAssigned: guest.isAssigned,
          sequenceNumber: guest.sequenceNumber,
          // ✅ TODAY'S STATUS
          hasCheckedIn: {
            entry: status.hasEntry,
            lunch: status.hasLunch,
            dinner: status.hasDinner,
            session: status.hasSession,
          },
          todaysCheckIns: status.checkIns.map(c => ({
            id: c.id,
            type: c.type,
            scannedAt: c.scannedAt,
            scannedBy: c.scannedBy,
            wasEdited: c.wasEdited,
            originalType: c.originalType,
          })),
        },
      };
    }

    throw new NotFoundException('QR code not found');
  }

  // ✅ CHECK-IN ENDPOINT (Creates check-in for TODAY)
  @Post(':qrCode')
  @ApiOperation({ 
    summary: 'Universal check-in',
    description: 'Creates check-in for TODAY. Allows daily repeats.'
  })
  async universalCheckIn(
    @Param('qrCode') qrCode: string,
    @Body() checkInDto: CheckInDto,
  ) {
    this.logger.log(`📝 Check-in: ${qrCode} - ${checkInDto.type}`);

    if (!['entry', 'lunch', 'dinner', 'session'].includes(checkInDto.type)) {
      throw new BadRequestException('Invalid check-in type');
    }

    const today = this.getTodayDate();

    // Validate behalf data
    if (checkInDto.wasBehalf) {
      if (!checkInDto.behalfName || !checkInDto.behalfMobile || !checkInDto.behalfGender) {
        throw new BadRequestException(
          'behalfName, behalfMobile, and behalfGender required for behalf check-in'
        );
      }
    }

    // Try farmer first
    const farmer = await this.registrationRepository.findOne({
      where: { qrCode },
    });
    
    if (farmer) {
      const status = await this.getFarmerTodayStatus(farmer.id, today);

      // ✅ VALIDATION: Entry must be done first (TODAY)
      if (checkInDto.type !== 'entry' && !status.hasEntry) {
        throw new BadRequestException(
          'Entry check-in must be completed first today'
        );
      }

      // ✅ Check if already checked in for this type TODAY
      const alreadyCheckedIn =
        (checkInDto.type === 'entry' && status.hasEntry) ||
        (checkInDto.type === 'lunch' && status.hasLunch) ||
        (checkInDto.type === 'dinner' && status.hasDinner) ||
        (checkInDto.type === 'session' && status.hasSession);

      if (alreadyCheckedIn) {
        return {
          success: false,
          message: `Already checked in for ${checkInDto.type} today`,
          alreadyCheckedIn: true,
          type: 'farmer',
          data: {
            id: farmer.id,
            name: farmer.name,
            qrCode: farmer.qrCode,
            hasCheckedIn: {
              entry: status.hasEntry,
              lunch: status.hasLunch,
              dinner: status.hasDinner,
              session: status.hasSession,
            },
          },
        };
      }

      // ✅ Update behalf info if provided
      if (checkInDto.wasBehalf) {
        farmer.behalfName = checkInDto.behalfName;
        farmer.behalfMobile = checkInDto.behalfMobile;
        farmer.behalfGender = checkInDto.behalfGender;
        farmer.isBehalfAttending = true;
        await this.registrationRepository.save(farmer);
      }

      // ✅ Create check-in for TODAY
      const checkIn = this.checkInRepository.create({
        type: checkInDto.type,
        registrationId: farmer.id,
        scannedBy: checkInDto.scannedBy,
        wasBehalf: checkInDto.wasBehalf || false,
        checkInDate: today as any,
        scannedAt: new Date(),
      });

      await this.checkInRepository.save(checkIn);

      // Get updated status
      const updatedStatus = await this.getFarmerTodayStatus(farmer.id, today);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful`,
        type: 'farmer',
        data: {
          id: farmer.id,
          name: farmer.name,
          qrCode: farmer.qrCode,
          checkInDate: today,
          hasCheckedIn: {
            entry: updatedStatus.hasEntry,
            lunch: updatedStatus.hasLunch,
            dinner: updatedStatus.hasDinner,
            session: updatedStatus.hasSession,
          },
        },
      };
    }

    // Try guest
    const guest = await this.guestPassRepository.findOne({
      where: { qrCode },
    });
    
    if (guest) {
      if (checkInDto.wasBehalf) {
        throw new BadRequestException('Behalf check-in not supported for guests');
      }

      const status = await this.getGuestTodayStatus(guest.id, today);

      // Validate entry first
      if (checkInDto.type !== 'entry' && !status.hasEntry) {
        throw new BadRequestException(
          'Entry check-in must be completed first today'
        );
      }

      // Check if already checked in
      const alreadyCheckedIn =
        (checkInDto.type === 'entry' && status.hasEntry) ||
        (checkInDto.type === 'lunch' && status.hasLunch) ||
        (checkInDto.type === 'dinner' && status.hasDinner) ||
        (checkInDto.type === 'session' && status.hasSession);

      if (alreadyCheckedIn) {
        return {
          success: false,
          message: `Already checked in for ${checkInDto.type} today`,
          alreadyCheckedIn: true,
          type: 'guest',
          data: {
            id: guest.id,
            name: guest.name,
            qrCode: guest.qrCode,
            hasCheckedIn: {
              entry: status.hasEntry,
              lunch: status.hasLunch,
              dinner: status.hasDinner,
              session: status.hasSession,
            },
          },
        };
      }

      // Create check-in
      const guestCheckIn = this.guestCheckInRepository.create({
        type: checkInDto.type,
        guestPassId: guest.id,
        scannedBy: checkInDto.scannedBy,
        checkInDate: today as any,
        scannedAt: new Date(),
      });

      await this.guestCheckInRepository.save(guestCheckIn);

      const updatedStatus = await this.getGuestTodayStatus(guest.id, today);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful`,
        type: 'guest',
        data: {
          id: guest.id,
          name: guest.name,
          qrCode: guest.qrCode,
          checkInDate: today,
          hasCheckedIn: {
            entry: updatedStatus.hasEntry,
            lunch: updatedStatus.hasLunch,
            dinner: updatedStatus.hasDinner,
            session: updatedStatus.hasSession,
          },
        },
      };
    }

    throw new NotFoundException('QR code not found');
  }

  // ✅ EDIT CHECK-IN ENDPOINT
  @Patch('check-in/:checkInId/edit')
  @ApiOperation({ 
    summary: 'Edit check-in type',
    description: 'Allows changing lunch/dinner/session. Entry cannot be edited.'
  })
  async editCheckIn(
    @Param('checkInId') checkInId: string,
    @Body() editDto: EditCheckInDto,
  ) {
    this.logger.log(`✏️ Edit check-in: ${checkInId} -> ${editDto.newType}`);

    // Try farmer check-in first
    const farmerCheckIn = await this.checkInRepository.findOne({
      where: { id: checkInId },
    });

    if (farmerCheckIn) {
      // ❌ Cannot edit entry
      if (farmerCheckIn.type === 'entry') {
        throw new BadRequestException('Entry check-in cannot be edited');
      }

      // ❌ Cannot change TO entry
      if (editDto.newType === 'entry' as any) {
        throw new BadRequestException('Cannot change to entry type');
      }

      // Store original type if first edit
      if (!farmerCheckIn.wasEdited) {
        farmerCheckIn.originalType = farmerCheckIn.type;
      }

      // Update
      farmerCheckIn.type = editDto.newType as any;
      farmerCheckIn.wasEdited = true;
      farmerCheckIn.editedBy = editDto.editedBy;
      farmerCheckIn.editedAt = new Date();

      await this.checkInRepository.save(farmerCheckIn);

      return {
        success: true,
        message: `Check-in updated from ${farmerCheckIn.originalType || farmerCheckIn.type} to ${editDto.newType}`,
        data: {
          id: farmerCheckIn.id,
          type: farmerCheckIn.type,
          originalType: farmerCheckIn.originalType,
          wasEdited: farmerCheckIn.wasEdited,
          editedBy: farmerCheckIn.editedBy,
          editedAt: farmerCheckIn.editedAt,
        },
      };
    }

    // Try guest check-in
    const guestCheckIn = await this.guestCheckInRepository.findOne({
      where: { id: checkInId },
    });

    if (guestCheckIn) {
      if (guestCheckIn.type === 'entry') {
        throw new BadRequestException('Entry check-in cannot be edited');
      }

      if (editDto.newType === 'entry' as any) {
        throw new BadRequestException('Cannot change to entry type');
      }

      if (!guestCheckIn.wasEdited) {
        guestCheckIn.originalType = guestCheckIn.type;
      }

      guestCheckIn.type = editDto.newType as any;
      guestCheckIn.wasEdited = true;
      guestCheckIn.editedBy = editDto.editedBy;
      guestCheckIn.editedAt = new Date();

      await this.guestCheckInRepository.save(guestCheckIn);

      return {
        success: true,
        message: `Check-in updated from ${guestCheckIn.originalType || guestCheckIn.type} to ${editDto.newType}`,
        data: {
          id: guestCheckIn.id,
          type: guestCheckIn.type,
          originalType: guestCheckIn.originalType,
          wasEdited: guestCheckIn.wasEdited,
          editedBy: guestCheckIn.editedBy,
          editedAt: guestCheckIn.editedAt,
        },
      };
    }

    throw new NotFoundException('Check-in not found');
  }
}