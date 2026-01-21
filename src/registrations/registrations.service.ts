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
import { AddBehalfDto } from './dto/add-behalf.dto';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { RegistrationCacheService } from './registration-cache.service';
import { UpdateRegistrationDto } from './dto/update-registration.dto';

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
    wasBehalfPerson: boolean = false,
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
        wasBehalf: wasBehalfPerson,
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
      this.registrationRepository.count({ where: { isBehalfAttending: true } }),
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

  // ✅ PERFECT: Orders by ID, District, Block - ALL ASC
async findAllForExport(
  district?: string, 
  block?: string,
  inclusionType?: 'mobile' | 'aadhaar' | 'qr',
  inclusionValues?: string[],
): Promise<Registration[]> {
  const queryBuilder = this.registrationRepository
    .createQueryBuilder('registration')
    .leftJoinAndSelect('registration.checkIns', 'checkIns')
	  .orderBy('registration.createdAt', 'ASC')
    .addOrderBy('registration.district', 'ASC')

  if (district) {
    queryBuilder.andWhere('registration.district = :district', { district });
  }

  if (block) {
    queryBuilder.andWhere('registration.block = :block', { block });
  }

  // ✅ NEW: Apply INCLUSION filters (only include specified values)
  if (inclusionType && inclusionValues && inclusionValues.length > 0) {
    switch (inclusionType) {
      case 'mobile':
        queryBuilder.andWhere('registration.mobile IN (:...inclusionValues)', { inclusionValues });
        break;
      case 'aadhaar':
        queryBuilder.andWhere('registration.aadhaarOrId IN (:...inclusionValues)', { inclusionValues });
        break;
      case 'qr':
        queryBuilder.andWhere('registration.qrCode IN (:...inclusionValues)', { inclusionValues });
        break;
    }
  }

  const result = await queryBuilder.getMany();
  
  console.log(`📦 findAllForExport: Fetched ${result.length} registrations (ordered by ID→District→Block)`);
  if (inclusionValues && inclusionValues.length > 0) {
    console.log(`   Included only ${inclusionValues.length} specific ${inclusionType}(s)`);
  }
  
  return result;
}

  async findByBlockForExport(block: string): Promise<Registration[]> {
    return this.registrationRepository.find({
      where: { block },
      relations: ['checkIns'],
      order: { 
        createdAt: 'ASC',        // ⭐ 1st: ID (prevents repetition)
        district: 'ASC',  // ⭐ 2nd: District
      },
    });
  }

  async findAll(): Promise<Registration[]> {
    return this.registrationRepository.find({
      relations: ['checkIns'],
      order: { 
        createdAt: 'ASC',        // ⭐ 1st: ID (prevents repetition)
        district: 'ASC',  // ⭐ 2nd: District
      },
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

  async addBehalf(id: string, dto: AddBehalfDto): Promise<Registration> {
    try {
      const registration = await this.registrationRepository.findOne({
        where: { id },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (registration.behalfName) {
        throw new BadRequestException('Behalf person already registered for this farmer');
      }

      registration.behalfName = dto.behalfName;
      registration.behalfMobile = dto.behalfMobile;
      registration.behalfGender = dto.behalfGender;
      registration.isBehalfAttending = true;

      const updated = await this.registrationRepository.save(registration);

      if (registration.qrCode) {
        this.cacheService.invalidateRegistration(registration.qrCode).catch(err => {
          console.error('Cache invalidation failed:', err);
        });
      }

      return updated;
    } catch (error) {
      console.error('❌ Add behalf error:', error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to add behalf person: ${error.message}`);
    }
  }

  async toggleBehalf(id: string, isBehalfAttending: boolean): Promise<Registration> {
    try {
      const registration = await this.registrationRepository.findOne({
        where: { id },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (!registration.behalfName) {
        throw new BadRequestException('No behalf person registered for this farmer');
      }

      registration.isBehalfAttending = isBehalfAttending;
      
      const updated = await this.registrationRepository.save(registration);

      if (registration.qrCode) {
        this.cacheService.invalidateRegistration(registration.qrCode).catch(err => {
          console.error('Cache invalidation failed:', err);
        });
      }

      return updated;
    } catch (error) {
      console.error('❌ Toggle behalf error:', error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to toggle behalf attendance: ${error.message}`);
    }
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
        isBehalfAttending: registration.isBehalfAttending,
        behalfName: registration.behalfName,
        behalfMobile: registration.behalfMobile,
        behalfGender: registration.behalfGender,
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

  async update(id: string, dto: UpdateRegistrationDto): Promise<Registration> {
    const registration = await this.registrationRepository.findOne({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (dto.mobile && dto.mobile !== registration.mobile) {
      const existingMobile = await this.registrationRepository.findOne({
        where: { mobile: dto.mobile },
      });
      if (existingMobile) {
        throw new ConflictException('Mobile number already registered');
      }
    }

    if (dto.aadhaarOrId && dto.aadhaarOrId !== registration.aadhaarOrId) {
      const existingAadhaar = await this.registrationRepository.findOne({
        where: { aadhaarOrId: dto.aadhaarOrId },
      });
      if (existingAadhaar) {
        throw new ConflictException('Aadhaar/ID already registered');
      }
    }

    Object.assign(registration, dto);

    const updated = await this.registrationRepository.save(registration);

    if (registration.qrCode) {
      this.cacheService.invalidateRegistration(registration.qrCode).catch(err => {
        console.error('Cache invalidation failed:', err);
      });
    }

    return updated;
  }

// ✅ FIXED: Replace the findAllForAttendanceExport method in registrations.service.ts


async findAllForAttendanceExport(
  date: string,
  district?: string,
  block?: string,
): Promise<Registration[]> {
  const queryBuilder = this.registrationRepository
    .createQueryBuilder('registration')
    .leftJoinAndSelect('registration.checkIns', 'checkIns')
    .orderBy('registration.createdAt', 'ASC')
    .addOrderBy('registration.district', 'ASC')
    .addOrderBy('registration.block', 'ASC');

  // Apply district filter
  if (district) {
    queryBuilder.andWhere('registration.district = :district', { district });
  }

  // Apply block filter
  if (block) {
    queryBuilder.andWhere('registration.block = :block', { block });
  }

  // ✅ Filter registrations that have at least one check-in on the specified date
  queryBuilder.andWhere((qb) => {
    const subQuery = qb
      .subQuery()
      .select('1')
      .from('check_ins', 'ci')
      .where('ci.registrationId = registration.id')
      .andWhere('DATE(ci.scannedAt) = :date', { date });

    return 'EXISTS ' + subQuery.getQuery();
  });

  queryBuilder.setParameter('date', date);

  const result = await queryBuilder.getMany();

  // ✅ Filter check-ins to only include those on the specified date
  result.forEach(registration => {
    registration.checkIns = registration.checkIns.filter(checkIn => {
      const checkInDate = new Date(checkIn.scannedAt).toISOString().split('T')[0];
      return checkInDate === date;
    });

    // ✅ Recompute check-in flags based on filtered check-ins for this date
    registration.hasEntryCheckIn = registration.checkIns.some(ci => ci.type === 'entry');
    registration.hasLunchCheckIn = registration.checkIns.some(ci => ci.type === 'lunch');
    registration.hasDinnerCheckIn = registration.checkIns.some(ci => ci.type === 'dinner');
    registration.hasSessionCheckIn = registration.checkIns.some(ci => ci.type === 'session');
  });

  console.log(`📦 findAllForAttendanceExport: Fetched ${result.length} registrations for ${date}`);
  if (district) {
    console.log(`   District: ${district}`);
  }
  if (block) {
    console.log(`   Block: ${block}`);
  }

  return result;
}
}