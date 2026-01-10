import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';

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

  // ✅ NEW: Lookup without check-in
  async universalLookup(qrCode: string) {
    // Try farmer first
    const farmer = await this.registrationRepo.findOne({
      where: { qrCode },
    });

    if (farmer) {
      // Get existing check-ins
      const checkIns = await this.checkInRepo.find({
        where: { registration: { id: farmer.id } },
      });

      const hasCheckedIn = {
        entry: checkIns.some(c => c.type === 'entry'),
        lunch: checkIns.some(c => c.type === 'lunch'),
        dinner: checkIns.some(c => c.type === 'dinner'),
        session: checkIns.some(c => c.type === 'session'),
      };

      return {
        success: true,
        attendeeType: 'FARMER' as const,
        data: {
          name: farmer.name,
          mobile: farmer.mobile,
          village: farmer.village,
          gp: farmer.gp,
          block: farmer.block,
          district: farmer.district,
          category: farmer.category,
          photoUrl: farmer.photoUrl,
          hasCheckedIn,
        },
      };
    }

    // Try guest
    const guestPass = await this.guestPassRepo.findOne({
      where: { qrCode },
    });

    if (guestPass) {
      // Get existing check-ins
      const checkIns = await this.guestCheckInRepo.find({
        where: { guestPass: { id: guestPass.id } },
      });

      const hasCheckedIn = {
        entry: checkIns.some(c => c.type === 'entry'),
        lunch: checkIns.some(c => c.type === 'lunch'),
        dinner: checkIns.some(c => c.type === 'dinner'),
        session: checkIns.some(c => c.type === 'session'),
      };

      return {
        success: true,
        attendeeType: 'GUEST' as const,
        data: {
          qrCode: guestPass.qrCode,
          category: guestPass.category,
          sequenceNumber: guestPass.sequenceNumber,
          isAssigned: guestPass.isAssigned,
          name: guestPass.name,
          mobile: guestPass.mobile,
          hasCheckedIn,
        },
      };
    }

    throw new NotFoundException(`QR code ${qrCode} not found`);
  }

  // ✅ Existing check-in method (unchanged)
  async universalCheckIn(qrCode: string, type: CheckInType, scannedBy: string) {
    // Try farmer first
    const farmer = await this.registrationRepo.findOne({
      where: { qrCode },
    });

    if (farmer) {
      return await this.farmerCheckIn(farmer, type, scannedBy);
    }

    // Try guest
    const guestPass = await this.guestPassRepo.findOne({
      where: { qrCode },
    });

    if (guestPass) {
      return await this.guestCheckIn(guestPass, type, scannedBy);
    }

    throw new NotFoundException(`QR code ${qrCode} not found`);
  }

  private async farmerCheckIn(farmer: Registration, type: CheckInType, scannedBy: string) {
    // Check if already checked in for this type
    const existing = await this.checkInRepo.findOne({
      where: {
        registration: { id: farmer.id },
        type,
      },
    });

    if (existing) {
      // Get all check-ins for status
      const allCheckIns = await this.checkInRepo.find({
        where: { registration: { id: farmer.id } },
      });

      const hasCheckedIn = {
        entry: allCheckIns.some(c => c.type === 'entry'),
        lunch: allCheckIns.some(c => c.type === 'lunch'),
        dinner: allCheckIns.some(c => c.type === 'dinner'),
        session: allCheckIns.some(c => c.type === 'session'),
      };

      return {
        success: false,
        message: `Already checked in for ${type}`,
        attendeeType: 'FARMER' as const,
        alreadyCheckedIn: true,
        data: {
          name: farmer.name,
          mobile: farmer.mobile,
          village: farmer.village,
          gp: farmer.gp,
          block: farmer.block,
          district: farmer.district,
          category: farmer.category,
          photoUrl: farmer.photoUrl,
          hasCheckedIn,
          type,
          scannedBy: existing.scannedBy,
          scannedAt: existing.scannedAt,
        },
      };
    }

    // Create new check-in
    const checkIn = this.checkInRepo.create({
      registration: farmer,
      type,
      scannedBy,
    });

    await this.checkInRepo.save(checkIn);

    // Update status flags asynchronously
    this.updateFarmerStatus(farmer.id, type).catch(err => 
      console.error('Failed to update farmer status:', err)
    );

    // Get updated check-ins
    const allCheckIns = await this.checkInRepo.find({
      where: { registration: { id: farmer.id } },
    });

    const hasCheckedIn = {
      entry: allCheckIns.some(c => c.type === 'entry'),
      lunch: allCheckIns.some(c => c.type === 'lunch'),
      dinner: allCheckIns.some(c => c.type === 'dinner'),
      session: allCheckIns.some(c => c.type === 'session'),
    };

    return {
      success: true,
      message: `Checked in for ${type}`,
      attendeeType: 'FARMER' as const,
      alreadyCheckedIn: false,
      data: {
        name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.village,
        gp: farmer.gp,
        block: farmer.block,
        district: farmer.district,
        category: farmer.category,
        photoUrl: farmer.photoUrl,
        hasCheckedIn,
        type,
        scannedBy,
        scannedAt: checkIn.scannedAt,
      },
    };
  }

  private async guestCheckIn(guestPass: GuestPass, type: CheckInType, scannedBy: string) {
    // Check if already checked in
    const existing = await this.guestCheckInRepo.findOne({
      where: {
        guestPass: { id: guestPass.id },
        type,
      },
    });

    if (existing) {
      // Get all check-ins for status
      const allCheckIns = await this.guestCheckInRepo.find({
        where: { guestPass: { id: guestPass.id } },
      });

      const hasCheckedIn = {
        entry: allCheckIns.some(c => c.type === 'entry'),
        lunch: allCheckIns.some(c => c.type === 'lunch'),
        dinner: allCheckIns.some(c => c.type === 'dinner'),
        session: allCheckIns.some(c => c.type === 'session'),
      };

      return {
        success: false,
        message: `Already checked in for ${type}`,
        attendeeType: 'GUEST' as const,
        alreadyCheckedIn: true,
        data: {
          qrCode: guestPass.qrCode,
          category: guestPass.category,
          sequenceNumber: guestPass.sequenceNumber,
          isAssigned: guestPass.isAssigned,
          name: guestPass.name,
          mobile: guestPass.mobile,
          hasCheckedIn,
          type,
          scannedBy: existing.scannedBy,
          checkedInAt: existing.checkedInAt,
        },
      };
    }

    // Create new check-in
    const checkIn = this.guestCheckInRepo.create({
      guestPass: guestPass,
      type,
      scannedBy,
    });

    await this.guestCheckInRepo.save(checkIn);

    // Update status flags asynchronously
    this.updateGuestStatus(guestPass.id, type).catch(err =>
      console.error('Failed to update guest status:', err)
    );

    // Get updated check-ins
    const allCheckIns = await this.guestCheckInRepo.find({
      where: { guestPass: { id: guestPass.id } },
    });

    const hasCheckedIn = {
      entry: allCheckIns.some(c => c.type === 'entry'),
      lunch: allCheckIns.some(c => c.type === 'lunch'),
      dinner: allCheckIns.some(c => c.type === 'dinner'),
      session: allCheckIns.some(c => c.type === 'session'),
    };

    return {
      success: true,
      message: `Checked in for ${type}`,
      attendeeType: 'GUEST' as const,
      alreadyCheckedIn: false,
      data: {
        qrCode: guestPass.qrCode,
        category: guestPass.category,
        sequenceNumber: guestPass.sequenceNumber,
        isAssigned: guestPass.isAssigned,
        name: guestPass.name,
        mobile: guestPass.mobile,
        hasCheckedIn,
        type,
        scannedBy,
        checkedInAt: checkIn.checkedInAt,
      },
    };
  }

  private async updateFarmerStatus(farmerId: string, type: CheckInType) {
    const updateData: any = {};
    
    if (type === 'entry') updateData.hasCheckedInEntry = true;
    if (type === 'lunch') updateData.hasCheckedInLunch = true;
    if (type === 'dinner') updateData.hasCheckedInDinner = true;
    if (type === 'session') updateData.hasCheckedInSession = true;

    await this.registrationRepo.update(farmerId, updateData);
  }

  private async updateGuestStatus(guestPassId: string, type: CheckInType) {
    const updateData: any = {};
    
    if (type === 'entry') updateData.hasCheckedInEntry = true;
    if (type === 'lunch') updateData.hasCheckedInLunch = true;
    if (type === 'dinner') updateData.hasCheckedInDinner = true;
    if (type === 'session') updateData.hasCheckedInSession = true;

    await this.guestPassRepo.update(guestPassId, updateData);
  }
}