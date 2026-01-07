import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import { CheckIn, CheckInType } from './entities/checkin.entity';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/checkin.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class RegistrationsService {

  constructor(
    @InjectRepository(Registration)
    private registrationRepo: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepo: Repository<CheckIn>,
  ) {}

  async create(data: CreateRegistrationDto) {
    // Check if mobile already exists
    const existingMobile = await this.registrationRepo.findOne({
      where: { mobile: data.mobile },
    });

    if (existingMobile) {
      throw new ConflictException('This mobile number is already registered');
    }

    // ✅ CHECK IF AADHAAR ALREADY EXISTS
    const existingAadhaar = await this.registrationRepo.findOne({
      where: { aadhaarOrId: data.aadhaarOrId },
    });

    if (existingAadhaar) {
      throw new ConflictException('This Aadhaar number is already registered');
    }

    const qrCode = `EVENT-${nanoid(10)}`.toUpperCase();
    
    const record = this.registrationRepo.create({
      ...data,
      qrCode,
    });
    
    return this.registrationRepo.save(record);
  }

  findAll() {
    return this.registrationRepo.find({ 
      order: { createdAt: 'DESC' },
      relations: ['checkIns'],
    });
  }

  async findByQrCode(qrCode: string) {
    const registration = await this.registrationRepo.findOne({
      where: { qrCode },
      relations: ['checkIns'],
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  async findById(id: string) {
    const registration = await this.registrationRepo.findOne({
      where: { id },
      relations: ['checkIns'],
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  // ✅ NEW METHOD: CHECK IF AADHAAR EXISTS
  async checkAadhaar(aadhaarOrId: string) {
    const registration = await this.registrationRepo.findOne({
      where: { aadhaarOrId },
    });

    if (registration) {
      return {
        exists: true,
        qrCode: registration.qrCode,
        name: registration.name,
      };
    }

    return {
      exists: false,
    };
  }

  async checkIn(qrCode: string, checkInData: CheckInDto) {
    const registration = await this.findByQrCode(qrCode);

    // Check if already checked in for this type today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingCheckIn = await this.checkInRepo.findOne({
      where: {
        registrationId: registration.id,
        type: checkInData.type,
      },
      order: { scannedAt: 'DESC' },
    });

    if (existingCheckIn) {
      const checkInDate = new Date(existingCheckIn.scannedAt);
      checkInDate.setHours(0, 0, 0, 0);
      
      if (checkInDate.getTime() === today.getTime()) {
        throw new BadRequestException(`Already checked in for ${checkInData.type} today`);
      }
    }

    const checkIn = this.checkInRepo.create({
      ...checkInData,
      registrationId: registration.id,
      wasDelegate: registration.isDelegateAttending,
    });

    await this.checkInRepo.save(checkIn);

    return {
      success: true,
      registration,
      checkIn,
      message: `Check-in successful for ${checkInData.type}`,
    };
  }

  async addDelegate(id: string, delegateData: AddDelegateDto) {
    const registration = await this.findById(id);

    registration.delegateName = delegateData.delegateName;
    registration.delegateMobile = delegateData.delegateMobile;
    registration.delegatePhotoUrl = delegateData.delegatePhotoUrl;
    registration.isDelegateAttending = true;

    return this.registrationRepo.save(registration);
  }

  async toggleDelegate(id: string, isDelegateAttending: boolean) {
    const registration = await this.findById(id);

    if (!registration.delegateName && isDelegateAttending) {
      throw new BadRequestException('No delegate registered');
    }

    registration.isDelegateAttending = isDelegateAttending;
    return this.registrationRepo.save(registration);
  }

  async getCheckIns(id: string) {
    const registration = await this.findById(id);
    return {
      registration,
      checkIns: registration.checkIns,
      checkInSummary: {
        entry: registration.checkIns.filter(c => c.type === CheckInType.ENTRY).length,
        lunch: registration.checkIns.filter(c => c.type === CheckInType.LUNCH).length,
        dinner: registration.checkIns.filter(c => c.type === CheckInType.DINNER).length,
      },
    };
  }
}