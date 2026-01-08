import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import { CheckIn } from './entities/checkin.entity';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';
import { StatisticsResponseDto } from './dto/statistics-response.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
  ) {}

  async create(dto: CreateRegistrationDto): Promise<Registration> {
    const existingMobile = await this.registrationRepository.findOne({
      where: { mobile: dto.mobile },
    });

    if (existingMobile) {
      throw new ConflictException('Mobile number already registered');
    }

    const existingAadhaar = await this.registrationRepository.findOne({
      where: { aadhaarOrId: dto.aadhaarOrId },
    });

    if (existingAadhaar) {
      throw new ConflictException('Aadhaar/ID already registered');
    }

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
      where: { registrationId: id },
      order: { scannedAt: 'ASC' },
    });

    const summary = {
      entry: checkIns.some(c => c.type === 'entry'),
      lunch: checkIns.some(c => c.type === 'lunch'),
      dinner: checkIns.some(c => c.type === 'dinner'),
      session: checkIns.some(c => c.type === 'session'),
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

  async findAllForExport(): Promise<Registration[]> {
    return this.registrationRepository.find({
      relations: ['checkIns'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBlockForExport(block: string): Promise<Registration[]> {
    return this.registrationRepository.find({
      where: { block },
      relations: ['checkIns'],
      order: { createdAt: 'DESC' },
    });
  }

  async getStatistics(includeBlockWise = false): Promise<StatisticsResponseDto> {
    // Get total registrations
    const totalRegistrations = await this.registrationRepository.count();

    // Get total delegates attending
    const totalDelegatesAttending = await this.registrationRepository.count({
      where: { isDelegateAttending: true },
    });

    // Get check-in statistics
    const entryCheckIns = await this.checkInRepository.count({
      where: { type: 'entry' },
    });

    const lunchCheckIns = await this.checkInRepository.count({
      where: { type: 'lunch' },
    });

    const dinnerCheckIns = await this.checkInRepository.count({
      where: { type: 'dinner' },
    });

    const sessionCheckIns = await this.checkInRepository.count({
      where: { type: 'session' },
    });

    const totalCheckIns = entryCheckIns + lunchCheckIns + dinnerCheckIns + sessionCheckIns;

    // Prepare base response
    const response: any = {
      totalRegistrations,
      totalAttendees: entryCheckIns,
      totalDelegatesAttending,
      checkIns: {
        entry: entryCheckIns,
        lunch: lunchCheckIns,
        dinner: dinnerCheckIns,
        session: sessionCheckIns,
        total: totalCheckIns,
      },
      generatedAt: new Date(),
    };

    // Add block-wise statistics if requested
    if (includeBlockWise) {
      const blocks = await this.registrationRepository
        .createQueryBuilder('registration')
        .select('registration.block', 'block')
        .groupBy('registration.block')
        .getRawMany();

      const blockWiseStats = await Promise.all(
        blocks.map(async ({ block }) => {
          const totalRegistrations = await this.registrationRepository.count({
            where: { block },
          });

          // Get check-ins for this block
          const entryCount = await this.checkInRepository
            .createQueryBuilder('checkIn')
            .leftJoin('checkIn.registration', 'registration')
            .where('registration.block = :block', { block })
            .andWhere('checkIn.type = :type', { type: 'entry' })
            .getCount();

          const lunchCount = await this.checkInRepository
            .createQueryBuilder('checkIn')
            .leftJoin('checkIn.registration', 'registration')
            .where('registration.block = :block', { block })
            .andWhere('checkIn.type = :type', { type: 'lunch' })
            .getCount();

          const dinnerCount = await this.checkInRepository
            .createQueryBuilder('checkIn')
            .leftJoin('checkIn.registration', 'registration')
            .where('registration.block = :block', { block })
            .andWhere('checkIn.type = :type', { type: 'dinner' })
            .getCount();

          const sessionCount = await this.checkInRepository
            .createQueryBuilder('checkIn')
            .leftJoin('checkIn.registration', 'registration')
            .where('registration.block = :block', { block })
            .andWhere('checkIn.type = :type', { type: 'session' })
            .getCount();

          return {
            block,
            totalRegistrations,
            entryCheckIns: entryCount,
            lunchCheckIns: lunchCount,
            dinnerCheckIns: dinnerCount,
            sessionCheckIns: sessionCount,
          };
        })
      );

      response.blockWiseStats = blockWiseStats;
    }

    return response;
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