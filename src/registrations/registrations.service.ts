import { 
  Injectable, 
  ConflictException, 
  NotFoundException, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import { CheckIn } from './entities/checkin.entity';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { RegistrationCacheService } from './registration-cache.service';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
    private cacheService: RegistrationCacheService,
  ) {}

  async create(dto: CreateRegistrationDto): Promise<Registration> {
    const existing = await this.registrationRepository.findOne({
      where: [
        { mobile: dto.mobile },
        { aadhaarOrId: dto.aadhaarOrId },
      ],
    });

    if (existing) {
      if (existing.mobile === dto.mobile) {
        throw new ConflictException('Mobile number already registered');
      }
      throw new ConflictException('Aadhaar/ID already registered');
    }

    const qrCode = this.generateQRCode();

    const registration = this.registrationRepository.create({
      name: dto.name,
      village: dto.village,
      district: dto.district,
      block: dto.block,
      mobile: dto.mobile,
      aadhaarOrId: dto.aadhaarOrId,
      gender: dto.gender,
      caste: dto.caste,
      category: dto.category,
      qrCode,
    });

    const saved = await this.registrationRepository.save(registration);
    
    this.cacheService.invalidateRegistration(qrCode).catch(err => {
      console.error('Cache update failed:', err);
    });
    
    return saved;
  }

  async createBulk(dtos: CreateRegistrationDto[]): Promise<{ 
    success: number; 
    failed: number; 
    errors: Array<{ mobile?: string; aadhaarOrId?: string; chunk?: number; error: string }> 
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ mobile?: string; aadhaarOrId?: string; chunk?: number; error: string }>,
    };

    const chunkSize = 100;
    
    for (let i = 0; i < dtos.length; i += chunkSize) {
      const chunk = dtos.slice(i, i + chunkSize);
      
      const mobiles = chunk.map(d => d.mobile);
      const aadhaarIds = chunk.map(d => d.aadhaarOrId);
      
      const existingRecords = await this.registrationRepository.find({
        where: [
          { mobile: In(mobiles) },
          { aadhaarOrId: In(aadhaarIds) },
        ],
        select: ['mobile', 'aadhaarOrId'],
      });
      
      const existingMobiles = new Set(existingRecords.map(r => r.mobile));
      const existingAadhaar = new Set(existingRecords.map(r => r.aadhaarOrId));
      
      const validRegistrations: Array<Partial<Registration> & { qrCode: string }> = [];
      
      for (const dto of chunk) {
        if (existingMobiles.has(dto.mobile)) {
          results.failed++;
          results.errors.push({
            mobile: dto.mobile,
            error: 'Mobile already registered',
          });
          continue;
        }
        
        if (existingAadhaar.has(dto.aadhaarOrId)) {
          results.failed++;
          results.errors.push({
            aadhaarOrId: dto.aadhaarOrId,
            error: 'Aadhaar already registered',
          });
          continue;
        }
        
        validRegistrations.push({
          name: dto.name,
          village: dto.village,
          district: dto.district,
          block: dto.block,
          mobile: dto.mobile,
          aadhaarOrId: dto.aadhaarOrId,
          gender: dto.gender,
          caste: dto.caste,
          category: dto.category,
          qrCode: this.generateQRCode(),
        });
        
        existingMobiles.add(dto.mobile);
        existingAadhaar.add(dto.aadhaarOrId);
      }
      
      if (validRegistrations.length > 0) {
        try {
          await this.registrationRepository.insert(validRegistrations);
          results.success += validRegistrations.length;
        } catch (error) {
          console.error('Bulk insert error:', error);
          results.failed += validRegistrations.length;
          results.errors.push({
            chunk: i,
            error: error.message,
          });
        }
      }
    }

    return results;
  }

  async findByQrCode(qrCode: string): Promise<Registration | null> {
    try {
      const cached = await this.cacheService.getByQrCode(qrCode);
      
      if (cached) {
        return cached as Registration;
      }
      
      console.log('⚠️ Cache miss for QR:', qrCode);
      return await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });
    } catch (error) {
      console.error('❌ QR lookup error:', error);
      return await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });
    }
  }

  async fastCheckIn(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session',
    scannedBy?: string,
    wasDelegate: boolean = false,
  ): Promise<{ success: boolean; message: string; registration?: any }> {
    try {
      const registration = await this.cacheService.getByQrCode(qrCode);
      
      if (!registration) {
        return {
          success: false,
          message: 'Registration not found',
        };
      }

      const checkInStatusMap = {
        entry: 'hasEntryCheckIn',
        lunch: 'hasLunchCheckIn',
        dinner: 'hasDinnerCheckIn',
        session: 'hasSessionCheckIn',
      };
      
      if (registration[checkInStatusMap[checkInType]]) {
        return {
          success: false,
          message: `${checkInType} already marked`,
          registration,
        };
      }

      const checkIn = this.checkInRepository.create({
        type: checkInType,
        registrationId: registration.id,
        scannedBy: scannedBy || 'Volunteer',
        wasDelegate,
      });

      this.checkInRepository.save(checkIn).catch(err => {
        console.error('❌ Check-in save error:', err);
      });

      this.cacheService.updateCheckInStatus(qrCode, checkInType).catch(err => {
        console.error('❌ Cache update error:', err);
      });

      return {
        success: true,
        message: `${checkInType} marked successfully`,
        registration: {
          ...registration,
          [checkInStatusMap[checkInType]]: true,
        },
      };
    } catch (error) {
      console.error('❌ Fast check-in error:', error);
      return {
        success: false,
        message: 'Check-in failed. Please try again.',
      };
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

  async getStatistics(includeBlockWise = false): Promise<StatisticsResponseDto> {
    const [
      totalRegistrations,
      totalDelegatesAttending,
      entryCheckIns,
      lunchCheckIns,
      dinnerCheckIns,
      sessionCheckIns,
    ] = await Promise.all([
      this.registrationRepository.count(),
      this.registrationRepository.count({ where: { isDelegateAttending: true } }),
      this.checkInRepository.count({ where: { type: 'entry' } }),
      this.checkInRepository.count({ where: { type: 'lunch' } }),
      this.checkInRepository.count({ where: { type: 'dinner' } }),
      this.checkInRepository.count({ where: { type: 'session' } }),
    ]);

    const totalCheckIns = entryCheckIns + lunchCheckIns + dinnerCheckIns + sessionCheckIns;

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

    if (includeBlockWise) {
      const blockStats = await this.registrationRepository
        .createQueryBuilder('reg')
        .select('reg.block', 'block')
        .addSelect('COUNT(DISTINCT reg.id)', 'totalRegistrations')
        .leftJoin('reg.checkIns', 'checkIn')
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'entry' THEN checkIn.id END)`,
          'entryCheckIns'
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'lunch' THEN checkIn.id END)`,
          'lunchCheckIns'
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'dinner' THEN checkIn.id END)`,
          'dinnerCheckIns'
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'session' THEN checkIn.id END)`,
          'sessionCheckIns'
        )
        .groupBy('reg.block')
        .getRawMany();

      response.blockWiseStats = blockStats;
    }

    return response;
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

  async addDelegate(id: string, dto: AddDelegateDto): Promise<Registration> {
    const registration = await this.findById(id);
    registration.delegateName = dto.delegateName;
    registration.delegateMobile = dto.delegateMobile;
    registration.delegateGender = dto.delegateGender;
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

  private generateQRCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'EVENT-';
    
    for (let i = 0; i < 11; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }

  async preloadCache(): Promise<void> {
    await this.cacheService.preloadAllRegistrations();
  }

  async healthCheck(): Promise<{ database: boolean; cache: boolean }> {
    const [dbHealthy, cacheHealthy] = await Promise.all([
      this.registrationRepository.query('SELECT 1').then(() => true).catch(() => false),
      this.cacheService.isHealthy(),
    ]);

    return {
      database: dbHealthy,
      cache: cacheHealthy,
    };
  }
}