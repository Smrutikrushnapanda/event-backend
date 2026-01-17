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
   * ✅ Get today's date as YYYY-MM-DD string (SERVER TIMEZONE)
   */
private getTodayDateString(): string {
  // Get current date in India timezone (Asia/Kolkata)
  const now = new Date();
  
  // Use Intl API to get date parts in India timezone
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  const dateString = `${year}-${month}-${day}`;
  
  this.logger.log(`📅 Server Date (India): ${dateString}`);
  this.logger.log(`📅 Server Time (UTC): ${now.toISOString()}`);
  
  return dateString;
}

  /**
   * ✅ Get today's start (00:00:00)
   */
private getTodayStart(): Date {
  // Get current date in India timezone
  const dateString = this.getTodayDateString(); // YYYY-MM-DD in IST
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date at midnight IST
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

  /**
   * ✅ Get tomorrow's start (end of today)
   */
  private getTomorrowStart(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * ✅ Convert YYYY-MM-DD string to Date object (start of that day)
   */
  private dateStringToDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  /**
   * ✅ Get today's check-ins for a farmer (FIXED - uses QueryBuilder)
   */
  private async getFarmerTodayStatus(farmerId: string) {
    const todayDateString = this.getTodayDateString();

    this.logger.log(`Checking farmer ${farmerId}`);
    this.logger.log(`Looking for check-ins on: ${todayDateString}`);

    const checkIns = await this.checkInRepository
      .createQueryBuilder('checkIn')
      .where('checkIn.registrationId = :farmerId', { farmerId })
      .andWhere('checkIn.checkInDate = :today', { today: todayDateString })
      .orderBy('checkIn.scannedAt', 'DESC')
      .getMany();

    this.logger.log(`Found ${checkIns.length} check-ins for today`);

    return {
      hasEntry: checkIns.some(c => c.type === 'entry'),
      hasLunch: checkIns.some(c => c.type === 'lunch'),
      hasDinner: checkIns.some(c => c.type === 'dinner'),
      hasSession: checkIns.some(c => c.type === 'session'),
      checkIns,
    };
  }

  /**
   * ✅ Get ALL check-ins for a farmer (for history display)
   */
  private async getAllFarmerCheckIns(farmerId: string) {
    return await this.checkInRepository.find({
      where: {
        registrationId: farmerId,
      },
      order: {
        scannedAt: 'DESC',
      },
    });
  }

  /**
   * ✅ Get today's check-ins for a guest (FIXED - uses QueryBuilder)
   */
  private async getGuestTodayStatus(guestId: string) {
    const todayDateString = this.getTodayDateString();

    this.logger.log(`Checking guest ${guestId}`);
    this.logger.log(`Looking for check-ins on: ${todayDateString}`);

    const checkIns = await this.guestCheckInRepository
      .createQueryBuilder('checkIn')
      .where('checkIn.guestPassId = :guestId', { guestId })
      .andWhere('checkIn.checkInDate = :today', { today: todayDateString })
      .orderBy('checkIn.scannedAt', 'DESC')
      .getMany();

    this.logger.log(`Found ${checkIns.length} check-ins for today`);

    return {
      hasEntry: checkIns.some(c => c.type === 'entry'),
      hasLunch: checkIns.some(c => c.type === 'lunch'),
      hasDinner: checkIns.some(c => c.type === 'dinner'),
      hasSession: checkIns.some(c => c.type === 'session'),
      checkIns,
    };
  }

  /**
   * ✅ Get ALL check-ins for a guest (for history display)
   */
  private async getAllGuestCheckIns(guestId: string) {
    return await this.guestCheckInRepository.find({
      where: {
        guestPassId: guestId,
      },
      order: {
        scannedAt: 'DESC',
      },
    });
  }

  /**
   * ✅ Format Date to YYYY-MM-DD string for response
   * Handles both Date objects and date strings
   */
  private formatDateForResponse(date: Date | string): string {
    if (!date) return '';
    
    // If it's already a string in YYYY-MM-DD format, return it
    if (typeof date === 'string') {
      return date;
    }
    
    // If it's a Date object, format it
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return String(date);
    }
  }

  // ============================================
  // LOOKUP ENDPOINT
  // ============================================
  @Post(':qrCode/lookup')
  @ApiOperation({ 
    summary: 'Lookup attendee by QR code',
    description: 'Returns attendee info with TODAY\'s check-in status and ALL historical check-ins'
  })
  async universalLookup(@Param('qrCode') qrCode: string) {
    const currentDate = this.getTodayDateString();
    this.logger.log(`🔍 Lookup: ${qrCode} on ${currentDate}`);

    // Try farmer first
    const farmer = await this.registrationRepository.findOne({
      where: { qrCode },
    });
    
    if (farmer) {
      const todayStatus = await this.getFarmerTodayStatus(farmer.id);
      const allCheckIns = await this.getAllFarmerCheckIns(farmer.id);
      
      this.logger.log(`✅ Farmer found: ${farmer.name}`);
      this.logger.log(`📊 Today's status: Entry=${todayStatus.hasEntry}, Lunch=${todayStatus.hasLunch}, Dinner=${todayStatus.hasDinner}, Session=${todayStatus.hasSession}`);
      
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
          // ✅ TODAY'S STATUS (date-aware)
          hasCheckedIn: {
            entry: todayStatus.hasEntry,
            lunch: todayStatus.hasLunch,
            dinner: todayStatus.hasDinner,
            session: todayStatus.hasSession,
          },
          // ✅ ALL CHECK-INS (with dates for frontend filtering)
          todaysCheckIns: allCheckIns.map(c => ({
            id: c.id,
            type: c.type,
            scannedAt: c.scannedAt.toISOString(),
            scannedBy: c.scannedBy,
            wasBehalf: c.wasBehalf,
            wasEdited: c.wasEdited,
            originalType: c.originalType,
            checkInDate: this.formatDateForResponse(c.checkInDate), // ✅ YYYY-MM-DD string
          })),
          currentDate: currentDate, // ✅ Always fresh server date
        },
      };
    }

    // Try guest
    const guest = await this.guestPassRepository.findOne({
      where: { qrCode },
    });
    
    if (guest) {
      const todayStatus = await this.getGuestTodayStatus(guest.id);
      const allCheckIns = await this.getAllGuestCheckIns(guest.id);
      
      this.logger.log(`✅ Guest found: ${guest.name || guest.category}`);
      this.logger.log(`📊 Today's status: Entry=${todayStatus.hasEntry}, Lunch=${todayStatus.hasLunch}, Dinner=${todayStatus.hasDinner}, Session=${todayStatus.hasSession}`);
      
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
          // ✅ TODAY'S STATUS (date-aware)
          hasCheckedIn: {
            entry: todayStatus.hasEntry,
            lunch: todayStatus.hasLunch,
            dinner: todayStatus.hasDinner,
            session: todayStatus.hasSession,
          },
          // ✅ ALL CHECK-INS (with dates for frontend filtering)
          todaysCheckIns: allCheckIns.map(c => ({
            id: c.id,
            type: c.type,
            scannedAt: c.scannedAt.toISOString(),
            scannedBy: c.scannedBy,
            wasEdited: c.wasEdited,
            originalType: c.originalType,
            checkInDate: this.formatDateForResponse(c.checkInDate), // ✅ YYYY-MM-DD string
          })),
          currentDate: currentDate, // ✅ Always fresh server date
        },
      };
    }

    throw new NotFoundException('QR code not found');
  }

  // ============================================
  // CHECK-IN ENDPOINT
  // ============================================
  @Post(':qrCode')
  @ApiOperation({ 
    summary: 'Universal check-in',
    description: 'Creates check-in for TODAY. Prevents duplicates per day. Allows daily repeats.'
  })
  async universalCheckIn(
    @Param('qrCode') qrCode: string,
    @Body() checkInDto: CheckInDto,
  ) {
    const currentDate = this.getTodayDateString();
    this.logger.log(`📝 Check-in: ${qrCode} - ${checkInDto.type} on ${currentDate}`);

    if (!['entry', 'lunch', 'dinner', 'session'].includes(checkInDto.type)) {
      throw new BadRequestException('Invalid check-in type');
    }

    const todayDate = this.dateStringToDate(currentDate); // ✅ Date object for today

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
      const status = await this.getFarmerTodayStatus(farmer.id);

      this.logger.log(`👤 Farmer: ${farmer.name}`);
      this.logger.log(`📊 Current status: Entry=${status.hasEntry}, Lunch=${status.hasLunch}, Dinner=${status.hasDinner}, Session=${status.hasSession}`);

      // ✅ RULE: Entry must be done first TODAY
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
        this.logger.warn(`⚠️ Already checked in for ${checkInDto.type} today`);
        return {
          success: false,
          message: `Already checked in for ${checkInDto.type} today (${currentDate})`,
          alreadyCheckedIn: true,
          type: 'farmer',
          data: {
            id: farmer.id,
            name: farmer.name,
            qrCode: farmer.qrCode,
            currentDate: currentDate,
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
        this.logger.log(`👥 Behalf info updated: ${checkInDto.behalfName}`);
      }

      // ✅ Create check-in for TODAY
      const checkIn = this.checkInRepository.create({
        type: checkInDto.type,
        registrationId: farmer.id,
        scannedBy: checkInDto.scannedBy,
        wasBehalf: checkInDto.wasBehalf || false,
        checkInDate: todayDate, // ✅ Date object (00:00:00 of today)
        scannedAt: new Date(), // ✅ Current timestamp
      });

      await this.checkInRepository.save(checkIn);
      this.logger.log(`✅ Check-in created: ID=${checkIn.id}, Date=${this.formatDateForResponse(checkIn.checkInDate)}`);

      // Get updated status
      const updatedStatus = await this.getFarmerTodayStatus(farmer.id);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful for ${currentDate}`,
        type: 'farmer',
        data: {
          id: farmer.id,
          name: farmer.name,
          qrCode: farmer.qrCode,
          checkInDate: currentDate,
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

      const status = await this.getGuestTodayStatus(guest.id);

      this.logger.log(`⭐ Guest: ${guest.name || guest.category}`);
      this.logger.log(`📊 Current status: Entry=${status.hasEntry}, Lunch=${status.hasLunch}, Dinner=${status.hasDinner}, Session=${status.hasSession}`);

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
        this.logger.warn(`⚠️ Already checked in for ${checkInDto.type} today`);
        return {
          success: false,
          message: `Already checked in for ${checkInDto.type} today (${currentDate})`,
          alreadyCheckedIn: true,
          type: 'guest',
          data: {
            id: guest.id,
            name: guest.name,
            qrCode: guest.qrCode,
            currentDate: currentDate,
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
        checkInDate: todayDate, // ✅ Date object
        scannedAt: new Date(),
      });

      await this.guestCheckInRepository.save(guestCheckIn);
      this.logger.log(`✅ Check-in created: ID=${guestCheckIn.id}, Date=${this.formatDateForResponse(guestCheckIn.checkInDate)}`);

      const updatedStatus = await this.getGuestTodayStatus(guest.id);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful for ${currentDate}`,
        type: 'guest',
        data: {
          id: guest.id,
          name: guest.name,
          qrCode: guest.qrCode,
          checkInDate: currentDate,
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

  // ============================================
  // EDIT CHECK-IN ENDPOINT
  // ============================================
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

      this.logger.log(`✅ Check-in edited: ${farmerCheckIn.originalType || farmerCheckIn.type} -> ${editDto.newType}`);

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

      this.logger.log(`✅ Check-in edited: ${guestCheckIn.originalType || guestCheckIn.type} -> ${editDto.newType}`);

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