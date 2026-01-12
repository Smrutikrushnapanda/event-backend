import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';

@Injectable()
export class UniversalCheckInService {
  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
  ) {}

  /**
   * Universal Lookup - Returns attendee info WITHOUT creating check-in
   */
  async lookupAttendee(qrCode: string) {
    console.log('🔍 Universal Lookup for:', qrCode);

    // Try to find in Registrations (Farmers)
    const farmer = await this.registrationRepository.findOne({
      where: { qrCode },
      relations: ['checkIns'],
    });

    if (farmer) {
      console.log('✅ Found Farmer:', farmer.name);
      
      const checkIns = await this.checkInRepository.find({
        where: { registrationId: farmer.id },
        order: { scannedAt: 'ASC' },
      });

      const hasCheckedIn = {
        entry: checkIns.some(c => c.type === 'entry'),
        lunch: checkIns.some(c => c.type === 'lunch'),
        dinner: checkIns.some(c => c.type === 'dinner'),
        session: checkIns.some(c => c.type === 'session'),
      };

      return {
        type: 'farmer',
        attendee: {
          id: farmer.id,
          qrCode: farmer.qrCode,
          name: farmer.name,
          village: farmer.village,
          district: farmer.district,
          block: farmer.block,
          mobile: farmer.mobile,
          aadhaarOrId: farmer.aadhaarOrId,
          gender: farmer.gender,
          caste: farmer.caste,
          category: farmer.category,
          delegateName: farmer.delegateName,
          delegateMobile: farmer.delegateMobile,
          delegateGender: farmer.delegateGender,
          isDelegateAttending: farmer.isDelegateAttending,
          createdAt: farmer.createdAt,
          hasCheckedIn,
          checkIns: checkIns.map(c => ({
            id: c.id,
            type: c.type,
            scannedAt: c.scannedAt,
            wasDelegate: c.wasDelegate,
            scannedBy: c.scannedBy,
          })),
        },
      };
    }

    // Try to find in Guest Passes
    const guest = await this.guestPassRepository.findOne({
      where: { qrCode },
    });

    if (guest) {
      console.log('✅ Found Guest:', guest.name || 'Unassigned');
      
      return {
        type: 'guest',
        attendee: {
          id: guest.id,
          qrCode: guest.qrCode,
          category: guest.category,
          sequenceNumber: guest.sequenceNumber,
          isAssigned: guest.isAssigned,
          name: guest.name,
          mobile: guest.mobile,
          assignedBy: guest.assignedBy,
          assignedAt: guest.assignedAt,
          hasCheckedIn: {
            entry: guest.hasEntryCheckIn,
            lunch: guest.hasLunchCheckIn,
            dinner: guest.hasDinnerCheckIn,
            session: guest.hasSessionCheckIn,
          },
          createdAt: guest.createdAt,
        },
      };
    }

    console.log('❌ QR Code not found in any system');
    throw new NotFoundException({
      statusCode: 404,
      message: 'QR Code not found',
      error: 'Not Found',
      qrCode: qrCode,
    });
  }

  /**
   * Universal Check-in - Actually performs the check-in
   */
  async checkInAttendee(
    qrCode: string,
    activityType: 'entry' | 'lunch' | 'dinner' | 'session',
    scannedBy?: string,
    wasDelegate: boolean = false,
  ) {
    console.log('✅ Universal Check-in:', qrCode, activityType);

    // Try Farmer first
    const farmer = await this.registrationRepository.findOne({
      where: { qrCode },
      relations: ['checkIns'],
    });

    if (farmer) {
      const existingCheckIn = await this.checkInRepository.findOne({
        where: {
          registrationId: farmer.id,
          type: activityType,
        },
      });

      if (existingCheckIn) {
        console.log('⚠️ Already checked in for', activityType);
        return {
          success: false,
          message: `${activityType} already marked`,
          type: 'farmer',
          attendee: {
            id: farmer.id,
            qrCode: farmer.qrCode,
            name: farmer.name,
            village: farmer.village,
            district: farmer.district,
            block: farmer.block,
            mobile: farmer.mobile,
            aadhaarOrId: farmer.aadhaarOrId,
            gender: farmer.gender,
            caste: farmer.caste,
            category: farmer.category,
            delegateName: farmer.delegateName,
            delegateMobile: farmer.delegateMobile,
            delegateGender: farmer.delegateGender,
            isDelegateAttending: farmer.isDelegateAttending,
          },
        };
      }

      const checkIn = this.checkInRepository.create({
        type: activityType,
        registrationId: farmer.id,
        scannedBy: scannedBy || 'System',
        wasDelegate,
      });

      await this.checkInRepository.save(checkIn);

      console.log('✅ Check-in successful for farmer');
      return {
        success: true,
        message: `${activityType} marked successfully`,
        type: 'farmer',
        attendee: {
          id: farmer.id,
          qrCode: farmer.qrCode,
          name: farmer.name,
          village: farmer.village,
          district: farmer.district,
          block: farmer.block,
          mobile: farmer.mobile,
          category: farmer.category,
          gender: farmer.gender,
          caste: farmer.caste,
        },
        checkedInAt: checkIn.scannedAt,
      };
    }

    // Try Guest Pass
    const guest = await this.guestPassRepository.findOne({
      where: { qrCode },
    });

    if (guest) {
      const checkInMap = {
        entry: 'hasEntryCheckIn',
        lunch: 'hasLunchCheckIn',
        dinner: 'hasDinnerCheckIn',
        session: 'hasSessionCheckIn',
      };

      const field = checkInMap[activityType];

      if (guest[field]) {
        console.log('⚠️ Guest already checked in for', activityType);
        return {
          success: false,
          message: `${activityType} already marked`,
          type: 'guest',
          attendee: {
            id: guest.id,
            qrCode: guest.qrCode,
            category: guest.category,
            name: guest.name,
            mobile: guest.mobile,
          },
        };
      }

      guest[field] = true;
      await this.guestPassRepository.save(guest);

      console.log('✅ Check-in successful for guest');
      return {
        success: true,
        message: `${activityType} marked successfully`,
        type: 'guest',
        attendee: {
          id: guest.id,
          qrCode: guest.qrCode,
          category: guest.category,
          name: guest.name,
          mobile: guest.mobile,
        },
        checkedInAt: new Date(),
      };
    }

    console.log('❌ QR Code not found');
    throw new NotFoundException({
      statusCode: 404,
      message: 'QR Code not found',
      error: 'Not Found',
      qrCode: qrCode,
    });
  }
}