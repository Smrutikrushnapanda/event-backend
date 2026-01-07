import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import { CheckIn } from './entities/checkin.entity';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
  ) {}

  async create(dto: CreateRegistrationDto): Promise<Registration> {
    // Check if mobile already exists
    const existingMobile = await this.registrationRepository.findOne({
      where: { mobile: dto.mobile },
    });

    if (existingMobile) {
      throw new ConflictException('Mobile number already registered');
    }

    // Check if Aadhaar already exists
    const existingAadhaar = await this.registrationRepository.findOne({
      where: { aadhaarOrId: dto.aadhaarOrId },
    });

    if (existingAadhaar) {
      throw new ConflictException('Aadhaar/ID already registered');
    }

    // Generate unique QR code
    const qrCode = this.generateQRCode();

    const registration = this.registrationRepository.create({
      ...dto,
      qrCode,
    });

    return this.registrationRepository.save(registration);
  }

  async findAll(): Promise<Registration[]> {
    return this.registrationRepository.find({
      relations: ['checkIns'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Registration> {
    const registration = await this.registrationRepository.findOne({
      where: { id },
      relations: ['checkIns'],
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  async findByQrCode(qrCode: string): Promise<Registration | null> {
    try {
      console.log('🔍 Service: Looking up QR code:', qrCode);
      
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });

      if (registration) {
        console.log('✅ Service: Found registration:', registration.id);
      } else {
        console.log('❌ Service: No registration found');
      }

      return registration;
    } catch (error) {
      console.error('❌ Service: Error finding registration:', error);
      throw error;
    }
  }

  async checkAadhaar(aadhaarOrId: string) {
    const registration = await this.registrationRepository.findOne({
      where: { aadhaarOrId },
    });

    if (registration) {
      return {
        exists: true,
        qrCode: registration.qrCode,
        name: registration.name,
      };
    }

    return { exists: false };
  }

  async addDelegate(id: string, dto: AddDelegateDto): Promise<Registration> {
    const registration = await this.findById(id);

    registration.delegateName = dto.delegateName;
    registration.delegateMobile = dto.delegateMobile;
    registration.delegatePhotoUrl = dto.delegatePhotoUrl;

    return this.registrationRepository.save(registration);
  }

  async toggleDelegate(id: string, isDelegateAttending: boolean): Promise<Registration> {
    const registration = await this.findById(id);

    if (!registration.delegateName) {
      throw new BadRequestException('No delegate registered for this user');
    }

    registration.isDelegateAttending = isDelegateAttending;

    return this.registrationRepository.save(registration);
  }

  async getCheckIns(id: string) {
    const registration = await this.findById(id);

    const checkIns = await this.checkInRepository.find({
      where: { registration: { id } },
      order: { scannedAt: 'ASC' },
    });

    const summary = {
      entry: checkIns.some(c => c.type === 'entry'),
      lunch: checkIns.some(c => c.type === 'lunch'),
      dinner: checkIns.some(c => c.type === 'dinner'),
      kit: checkIns.some(c => c.type === 'kit'),
    };

    return {
      registration: {
        id: registration.id,
        name: registration.name,
        qrCode: registration.qrCode,
        isDelegateAttending: registration.isDelegateAttending,
        delegateName: registration.delegateName,
      },
      checkIns,
      summary,
    };
  }

  // ✅ Export methods
  async findAllForExport(): Promise<Registration[]> {
    return this.registrationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByBlockForExport(block: string): Promise<Registration[]> {
    return this.registrationRepository.find({
      where: { block },
      order: { createdAt: 'DESC' },
    });
  }

  private generateQRCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'EVENT-';
    
    for (let i = 0; i < 11; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }
}