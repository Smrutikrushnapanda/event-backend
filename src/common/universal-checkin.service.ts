import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';

// ✅ ADD TYPE DEFINITION
type CheckInType = 'entry' | 'lunch' | 'dinner' | 'session';

@Injectable()
export class UniversalCheckInService {
  constructor(
    @InjectRepository(Registration)
    private registrationRepo: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepo: Repository<CheckIn>,
    @InjectRepository(GuestPass)
    private guestPassRepo: Repository<GuestPass>,
    @InjectRepository(GuestCheckIn)
    private guestCheckInRepo: Repository<GuestCheckIn>,
  ) {}

  // ✅ UPDATE METHOD SIGNATURE
  async universalCheckIn(
    qrCode: string,
    type: CheckInType,
    scannedBy: string,
  ) {
    // First, try to find in farmer registrations
    const farmer = await this.registrationRepo.findOne({
      where: { qrCode },
    });

    if (farmer) {
      // It's a farmer - use farmer check-in logic
      return this.farmerCheckIn(farmer, type, scannedBy);
    }

    // If not farmer, try guest passes
    const guestPass = await this.guestPassRepo.findOne({
      where: { qrCode },
    });

    if (guestPass) {
      // It's a guest pass - use guest check-in logic
      return this.guestCheckIn(guestPass, type, scannedBy);
    }

    // QR code not found in either table
    throw new NotFoundException({
      success: false,
      message: 'QR code not found',
      error: 'This QR code is not registered in the system',
    });
  }

  // ✅ UPDATE METHOD SIGNATURE
  private async farmerCheckIn(
    farmer: Registration,
    type: CheckInType,
    scannedBy: string,
  ) {
    // Check if already checked in
    const existingCheckIn = await this.checkInRepo.findOne({
      where: {
        registration: { id: farmer.id }, // ✅ FIXED: Use relation
        type,
      },
    });

    if (existingCheckIn) {
      return {
        success: false,
        message: 'Already checked in',
        alreadyCheckedIn: true,
        attendeeType: 'FARMER',
        data: {
          name: farmer.name,
          mobile: farmer.mobile,
          village: farmer.village,
          gp: farmer.gp,
          block: farmer.block,
          district: farmer.district,
          category: farmer.category,
          checkedInAt: existingCheckIn.scannedAt,
        },
      };
    }

    // ✅ FIXED: Create check-in with proper relation
    const checkInRecord = this.checkInRepo.create({
      registration: farmer,
      type,
      scannedBy,
    });

    this.checkInRepo
      .save(checkInRecord)
      .catch((err) => console.error('Async check-in save error:', err));

    // Update status flags immediately
    const updateData: any = {};
    if (type === 'entry') updateData.hasEntryCheckIn = true;
    if (type === 'lunch') updateData.hasLunchCheckIn = true;
    if (type === 'dinner') updateData.hasDinnerCheckIn = true;
    if (type === 'session') updateData.hasSessionCheckIn = true;

    if (Object.keys(updateData).length > 0) {
      this.registrationRepo
        .update({ id: farmer.id }, updateData)
        .catch((err) => console.error('Async status update error:', err));
    }

    return {
      success: true,
      message: 'Check-in successful',
      attendeeType: 'FARMER',
      data: {
        name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.village,
        gp: farmer.gp,
        block: farmer.block,
        district: farmer.district,
        category: farmer.category,
        type,
        scannedBy,
        scannedAt: new Date(),
      },
    };
  }

  // ✅ UPDATE METHOD SIGNATURE
  private async guestCheckIn(
    guestPass: GuestPass,
    type: CheckInType,
    scannedBy: string,
  ) {
    // Check if already checked in
    const existingCheckIn = await this.guestCheckInRepo.findOne({
      where: {
        guestPass: { id: guestPass.id }, // ✅ FIXED: Use relation
        type,
      },
    });

    if (existingCheckIn) {
      return {
        success: false,
        message: 'Already checked in',
        alreadyCheckedIn: true,
        attendeeType: 'GUEST',
        data: {
          qrCode: guestPass.qrCode,
          category: guestPass.category,
          name: guestPass.name || `${guestPass.category} Guest`,
          mobile: guestPass.mobile || 'Not assigned',
          isAssigned: guestPass.isAssigned,
          checkedInAt: existingCheckIn.scannedAt,
        },
      };
    }

    // ✅ FIXED: Create check-in with proper relation
    const checkInRecord = this.guestCheckInRepo.create({
      guestPass: guestPass,
      type,
      scannedBy,
    });

    this.guestCheckInRepo
      .save(checkInRecord)
      .catch((err) => console.error('Async guest check-in save error:', err));

    // Update status flags immediately
    const updateData: any = {};
    if (type === 'entry') updateData.hasEntryCheckIn = true;
    if (type === 'lunch') updateData.hasLunchCheckIn = true;
    if (type === 'dinner') updateData.hasDinnerCheckIn = true;
    if (type === 'session') updateData.hasSessionCheckIn = true;

    if (Object.keys(updateData).length > 0) {
      this.guestPassRepo
        .update({ id: guestPass.id }, updateData)
        .catch((err) =>
          console.error('Async guest status update error:', err),
        );
    }

    return {
      success: true,
      message: 'Check-in successful',
      attendeeType: 'GUEST',
      data: {
        qrCode: guestPass.qrCode,
        category: guestPass.category,
        name: guestPass.name || `${guestPass.category} Guest`,
        mobile: guestPass.mobile || 'Not assigned',
        isAssigned: guestPass.isAssigned,
        type,
        scannedBy,
        scannedAt: new Date(),
      },
    };
  }
}