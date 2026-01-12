import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';

@Injectable()
export class UniversalCheckinService {
  private readonly logger = new Logger(UniversalCheckinService.name);

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
  ) {}

  async lookupByQrCode(qrCode: string) {
    // Try farmer first
    try {
      const farmer = await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });

      if (farmer) {
        return {
          success: true,
          type: 'farmer',
          attendeeType: 'FARMER',
          attendee: {
            id: farmer.id,
            qrCode: farmer.qrCode,
            name: farmer.name,
            mobile: farmer.mobile,
            village: farmer.village,
            block: farmer.block,
            district: farmer.district,
            category: farmer.category,
            gender: farmer.gender,
            caste: farmer.caste,
            aadhaarOrId: farmer.aadhaarOrId,
            behalfName: farmer.behalfName,
            behalfMobile: farmer.behalfMobile,
            behalfGender: farmer.behalfGender,
            isBehalfAttending: farmer.isBehalfAttending,
            hasEntryCheckIn: farmer.hasEntryCheckIn,
            hasLunchCheckIn: farmer.hasLunchCheckIn,
            hasDinnerCheckIn: farmer.hasDinnerCheckIn,
            hasSessionCheckIn: farmer.hasSessionCheckIn,
            checkIns: farmer.checkIns.map(c => ({
              id: c.id,
              type: c.type,
              scannedAt: c.scannedAt,
              scannedBy: c.scannedBy,
              wasBehalf: c.wasBehalf,
            })),
            createdAt: farmer.createdAt,
            // ✅ REMOVED: updatedAt doesn't exist in Registration entity
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Farmer not found for QR: ${qrCode}`);
    }

    // Try guest
    try {
      const guest = await this.guestPassRepository.findOne({
        where: { qrCode },
      });

      if (guest) {
        return {
          success: true,
          type: 'guest',
          attendeeType: 'GUEST',
          attendee: {
            id: guest.id,
            qrCode: guest.qrCode,
            category: guest.category,
            sequenceNumber: guest.sequenceNumber,
            isAssigned: guest.isAssigned,
            name: guest.name,
            mobile: guest.mobile,
            hasEntryCheckIn: guest.hasEntryCheckIn,
            hasLunchCheckIn: guest.hasLunchCheckIn,
            hasDinnerCheckIn: guest.hasDinnerCheckIn,
            hasSessionCheckIn: guest.hasSessionCheckIn,
            createdAt: guest.createdAt,
            // ✅ REMOVED: updatedAt if it doesn't exist in GuestPass either
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Guest not found for QR: ${qrCode}`);
    }

    throw new NotFoundException('QR code not found');
  }

  async checkIn(qrCode: string, type: string, scannedBy: string, wasBehalf = false) {
    if (!['entry', 'lunch', 'dinner', 'session'].includes(type)) {
      throw new BadRequestException('Invalid check-in type');
    }

    // Cast type to proper union type
    const checkInType = type as 'entry' | 'lunch' | 'dinner' | 'session';

    // Try farmer first
    try {
      const farmer = await this.registrationRepository.findOne({
        where: { qrCode },
      });

      if (farmer) {
        // Check if already checked in
        const alreadyCheckedIn =
          (checkInType === 'entry' && farmer.hasEntryCheckIn) ||
          (checkInType === 'lunch' && farmer.hasLunchCheckIn) ||
          (checkInType === 'dinner' && farmer.hasDinnerCheckIn) ||
          (checkInType === 'session' && farmer.hasSessionCheckIn);

        if (alreadyCheckedIn) {
          return {
            success: false,
            message: `Already checked in for ${checkInType}`,
            alreadyCheckedIn: true,
            type: 'farmer',
            attendeeType: 'FARMER',
            attendee: {
              id: farmer.id,
              qrCode: farmer.qrCode,
              name: farmer.name,
              mobile: farmer.mobile,
              village: farmer.village,
              block: farmer.block,
              district: farmer.district,
              category: farmer.category,
              behalfName: farmer.behalfName,
              behalfMobile: farmer.behalfMobile,
              behalfGender: farmer.behalfGender,
              isBehalfAttending: farmer.isBehalfAttending,
              hasEntryCheckIn: farmer.hasEntryCheckIn,
              hasLunchCheckIn: farmer.hasLunchCheckIn,
              hasDinnerCheckIn: farmer.hasDinnerCheckIn,
              hasSessionCheckIn: farmer.hasSessionCheckIn,
            },
          };
        }

        // ✅ FIXED: Create check-in record with correct field names
        const checkIn = this.checkInRepository.create({
          type: checkInType, // Now properly typed
          registrationId: farmer.id, // Use registrationId instead of registration
          scannedBy,
          wasBehalf,
          scannedAt: new Date(),
        });

        await this.checkInRepository.save(checkIn);

        // Update farmer flags
        if (checkInType === 'entry') farmer.hasEntryCheckIn = true;
        if (checkInType === 'lunch') farmer.hasLunchCheckIn = true;
        if (checkInType === 'dinner') farmer.hasDinnerCheckIn = true;
        if (checkInType === 'session') farmer.hasSessionCheckIn = true;

        await this.registrationRepository.save(farmer);

        return {
          success: true,
          message: `${checkInType} check-in successful`,
          type: 'farmer',
          attendeeType: 'FARMER',
          attendee: {
            id: farmer.id,
            qrCode: farmer.qrCode,
            name: farmer.name,
            mobile: farmer.mobile,
            village: farmer.village,
            block: farmer.block,
            district: farmer.district,
            category: farmer.category,
            behalfName: farmer.behalfName,
            behalfMobile: farmer.behalfMobile,
            behalfGender: farmer.behalfGender,
            isBehalfAttending: farmer.isBehalfAttending,
            hasEntryCheckIn: farmer.hasEntryCheckIn,
            hasLunchCheckIn: farmer.hasLunchCheckIn,
            hasDinnerCheckIn: farmer.hasDinnerCheckIn,
            hasSessionCheckIn: farmer.hasSessionCheckIn,
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Farmer not found for QR: ${qrCode}`);
    }

    // Try guest
    try {
      const guest = await this.guestPassRepository.findOne({
        where: { qrCode },
      });

      if (guest) {
        // Check if already checked in
        const alreadyCheckedIn =
          (checkInType === 'entry' && guest.hasEntryCheckIn) ||
          (checkInType === 'lunch' && guest.hasLunchCheckIn) ||
          (checkInType === 'dinner' && guest.hasDinnerCheckIn) ||
          (checkInType === 'session' && guest.hasSessionCheckIn);

        if (alreadyCheckedIn) {
          return {
            success: false,
            message: `Already checked in for ${checkInType}`,
            alreadyCheckedIn: true,
            type: 'guest',
            attendeeType: 'GUEST',
            attendee: {
              id: guest.id,
              qrCode: guest.qrCode,
              category: guest.category,
              sequenceNumber: guest.sequenceNumber,
              isAssigned: guest.isAssigned,
              name: guest.name,
              mobile: guest.mobile,
              hasEntryCheckIn: guest.hasEntryCheckIn,
              hasLunchCheckIn: guest.hasLunchCheckIn,
              hasDinnerCheckIn: guest.hasDinnerCheckIn,
              hasSessionCheckIn: guest.hasSessionCheckIn,
            },
          };
        }

        // Update guest flags
        if (checkInType === 'entry') guest.hasEntryCheckIn = true;
        if (checkInType === 'lunch') guest.hasLunchCheckIn = true;
        if (checkInType === 'dinner') guest.hasDinnerCheckIn = true;
        if (checkInType === 'session') guest.hasSessionCheckIn = true;

        await this.guestPassRepository.save(guest);

        return {
          success: true,
          message: `${checkInType} check-in successful`,
          type: 'guest',
          attendeeType: 'GUEST',
          attendee: {
            id: guest.id,
            qrCode: guest.qrCode,
            category: guest.category,
            sequenceNumber: guest.sequenceNumber,
            isAssigned: guest.isAssigned,
            name: guest.name,
            mobile: guest.mobile,
            hasEntryCheckIn: guest.hasEntryCheckIn,
            hasLunchCheckIn: guest.hasLunchCheckIn,
            hasDinnerCheckIn: guest.hasDinnerCheckIn,
            hasSessionCheckIn: guest.hasSessionCheckIn,
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Guest not found for QR: ${qrCode}`);
    }

    throw new NotFoundException('QR code not found');
  }
}