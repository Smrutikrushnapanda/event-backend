import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GuestPass } from './entities/guest-pass.entity';
import { GuestCheckIn } from './entities/guest-checkin.entity';
import { PassCategory, CATEGORY_PREFIXES } from './enums/pass-category.enum';
import { GeneratePassesDto } from './dto/generate-passes.dto';
import { AssignDetailsDto } from './dto/assign-details.dto';

@Injectable()
export class GuestPassesService {
  constructor(
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(GuestCheckIn)
    private guestCheckInRepository: Repository<GuestCheckIn>,
  ) {}

  /**
   * Generate guest passes with sequential numbering
   */
  async generatePasses(dto: GeneratePassesDto): Promise<{
    generated: number;
    categories: Record<string, { count: number; range: string }>;
  }> {
    const result = {
      generated: 0,
      categories: {} as Record<string, { count: number; range: string }>,
    };

    // Generate DELEGATE passes
    if (dto.delegates && dto.delegates > 0) {
      const delegateResult = await this.generateCategoryPasses(
        PassCategory.DELEGATE,
        dto.delegates,
      );
      result.generated += delegateResult.count;
      result.categories.DELEGATE = delegateResult;
    }

    // Generate VVIP passes
    if (dto.vvip && dto.vvip > 0) {
      const vvipResult = await this.generateCategoryPasses(
        PassCategory.VVIP,
        dto.vvip,
      );
      result.generated += vvipResult.count;
      result.categories.VVIP = vvipResult;
    }

    // Generate VISITOR passes
    if (dto.visitors && dto.visitors > 0) {
      const visitorResult = await this.generateCategoryPasses(
        PassCategory.VISITOR,
        dto.visitors,
      );
      result.generated += visitorResult.count;
      result.categories.VISITOR = visitorResult;
    }

    return result;
  }

  /**
   * Generate passes for a specific category with auto-increment
   */
  private async generateCategoryPasses(
    category: PassCategory,
    count: number,
  ): Promise<{ count: number; range: string }> {
    // Find the last sequence number for this category
    const lastPass = await this.guestPassRepository.findOne({
      where: { category },
      order: { sequenceNumber: 'DESC' },
    });

    const startSequence = lastPass ? lastPass.sequenceNumber + 1 : 1;
    const endSequence = startSequence + count - 1;

    const prefix = CATEGORY_PREFIXES[category];
    const passes: Partial<GuestPass>[] = [];

    for (let i = 0; i < count; i++) {
      const sequenceNumber = startSequence + i;
      const qrCode = `${prefix}-${String(sequenceNumber).padStart(3, '0')}`;

      passes.push({
        qrCode,
        category,
        sequenceNumber,
        isAssigned: false,
      });
    }

    // Batch insert
    await this.guestPassRepository.insert(passes);

    return {
      count,
      range: `${prefix}-${String(startSequence).padStart(3, '0')} to ${prefix}-${String(endSequence).padStart(3, '0')}`,
    };
  }

  /**
   * Assign name and mobile to a guest pass
   */
  async assignDetails(
    qrCode: string,
    dto: AssignDetailsDto,
  ): Promise<GuestPass> {
    const pass = await this.guestPassRepository.findOne({
      where: { qrCode },
    });

    if (!pass) {
      throw new NotFoundException(`Guest pass ${qrCode} not found`);
    }

    if (pass.isAssigned) {
      throw new ConflictException(
        `Guest pass ${qrCode} is already assigned to ${pass.name}`,
      );
    }

    // Check if mobile is already used
    const existingPass = await this.guestPassRepository.findOne({
      where: { mobile: dto.mobile },
    });

    if (existingPass) {
      throw new ConflictException(
        `Mobile ${dto.mobile} is already assigned to ${existingPass.qrCode}`,
      );
    }

    pass.name = dto.name;
    pass.mobile = dto.mobile;
    pass.isAssigned = true;
    pass.assignedBy = dto.assignedBy;
    pass.assignedAt = new Date();

    return this.guestPassRepository.save(pass);
  }

  /**
   * Fast check-in for guest passes
   */
  async fastCheckIn(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session',
    scannedBy?: string,
  ): Promise<{ success: boolean; message: string; pass?: any }> {
    const pass = await this.guestPassRepository.findOne({
      where: { qrCode },
    });

    if (!pass) {
      return {
        success: false,
        message: 'Guest pass not found',
      };
    }

    const checkInStatusMap = {
      entry: 'hasEntryCheckIn',
      lunch: 'hasLunchCheckIn',
      dinner: 'hasDinnerCheckIn',
      session: 'hasSessionCheckIn',
    };

    if (pass[checkInStatusMap[checkInType]]) {
      return {
        success: false,
        message: `${checkInType} already marked`,
        pass,
      };
    }

    // Create check-in record
    const checkIn = this.guestCheckInRepository.create({
      type: checkInType,
      guestPassId: pass.id,
      scannedBy: scannedBy || 'Volunteer',
    });

    await this.guestCheckInRepository.save(checkIn);

    // Update pass status
    pass[checkInStatusMap[checkInType]] = true;
    await this.guestPassRepository.save(pass);

    return {
      success: true,
      message: `${checkInType} marked successfully`,
      pass: {
        ...pass,
        displayName: pass.isAssigned ? pass.name : `${pass.category} Guest`,
      },
    };
  }

  /**
   * Get pass by QR code
   */
  async getByQrCode(qrCode: string): Promise<GuestPass> {
    const pass = await this.guestPassRepository.findOne({
      where: { qrCode },
      relations: ['checkIns'],
    });

    if (!pass) {
      throw new NotFoundException(`Guest pass ${qrCode} not found`);
    }

    return pass;
  }

  /**
   * Get all passes with optional filters
   */
  async getAllPasses(filters?: {
    category?: PassCategory;
    isAssigned?: boolean;
  }): Promise<GuestPass[]> {
    const queryBuilder = this.guestPassRepository
      .createQueryBuilder('pass')
      .leftJoinAndSelect('pass.checkIns', 'checkIns')
      .orderBy('pass.category', 'ASC')
      .addOrderBy('pass.sequenceNumber', 'ASC');

    if (filters?.category) {
      queryBuilder.andWhere('pass.category = :category', {
        category: filters.category,
      });
    }

    if (filters?.isAssigned !== undefined) {
      queryBuilder.andWhere('pass.isAssigned = :isAssigned', {
        isAssigned: filters.isAssigned,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get statistics
   */
  async getStatistics(includeBreakdown = false): Promise<any> {
    const [
      totalPasses,
      totalAssigned,
      totalUnassigned,
      delegateCount,
      vvipCount,
      visitorCount,
      entryCheckIns,
      lunchCheckIns,
      dinnerCheckIns,
      sessionCheckIns,
    ] = await Promise.all([
      this.guestPassRepository.count(),
      this.guestPassRepository.count({ where: { isAssigned: true } }),
      this.guestPassRepository.count({ where: { isAssigned: false } }),
      this.guestPassRepository.count({
        where: { category: PassCategory.DELEGATE },
      }),
      this.guestPassRepository.count({ where: { category: PassCategory.VVIP } }),
      this.guestPassRepository.count({
        where: { category: PassCategory.VISITOR },
      }),
      this.guestCheckInRepository.count({ where: { type: 'entry' } }),
      this.guestCheckInRepository.count({ where: { type: 'lunch' } }),
      this.guestCheckInRepository.count({ where: { type: 'dinner' } }),
      this.guestCheckInRepository.count({ where: { type: 'session' } }),
    ]);

    const response: any = {
      totalPasses,
      totalAssigned,
      totalUnassigned,
      assignmentPercentage: ((totalAssigned / totalPasses) * 100).toFixed(1),
      byCategory: {
        DELEGATE: delegateCount,
        VVIP: vvipCount,
        VISITOR: visitorCount,
      },
      checkIns: {
        entry: entryCheckIns,
        lunch: lunchCheckIns,
        dinner: dinnerCheckIns,
        session: sessionCheckIns,
        total: entryCheckIns + lunchCheckIns + dinnerCheckIns + sessionCheckIns,
      },
      generatedAt: new Date(),
    };

    if (includeBreakdown) {
      const categoryStats = await this.guestPassRepository
        .createQueryBuilder('pass')
        .select('pass.category', 'category')
        .addSelect('COUNT(DISTINCT pass.id)', 'totalPasses')
        .addSelect(
          'COUNT(DISTINCT CASE WHEN pass.isAssigned = true THEN pass.id END)',
          'assignedPasses',
        )
        .leftJoin('pass.checkIns', 'checkIn')
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'entry' THEN checkIn.id END)`,
          'entryCheckIns',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'lunch' THEN checkIn.id END)`,
          'lunchCheckIns',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'dinner' THEN checkIn.id END)`,
          'dinnerCheckIns',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN checkIn.type = 'session' THEN checkIn.id END)`,
          'sessionCheckIns',
        )
        .groupBy('pass.category')
        .getRawMany();

      response.categoryBreakdown = categoryStats;
    }

    return response;
  }

  /**
   * Get all passes for export
   */
  async getAllPassesForExport(): Promise<GuestPass[]> {
    return this.guestPassRepository.find({
      relations: ['checkIns'],
      order: {
        category: 'ASC',
        sequenceNumber: 'ASC',
      },
    });
  }

  /**
   * Get passes by category for export
   */
  async getPassesByCategoryForExport(
    category: PassCategory,
  ): Promise<GuestPass[]> {
    return this.guestPassRepository.find({
      where: { category },
      relations: ['checkIns'],
      order: { sequenceNumber: 'ASC' },
    });
  }
}