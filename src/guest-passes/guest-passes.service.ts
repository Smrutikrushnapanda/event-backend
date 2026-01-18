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
import { BulkAssignDto } from './dto/bulk-assign.dto';

@Injectable()
export class GuestPassesService {
  constructor(
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(GuestCheckIn)
    private guestCheckInRepository: Repository<GuestCheckIn>,
  ) {}

  async generatePasses(dto: GeneratePassesDto): Promise<{
    generated: number;
    categories: Record<string, { count: number; range: string }>;
  }> {
    const result = {
      generated: 0,
      categories: {} as Record<string, { count: number; range: string }>,
    };

    if (dto.delegates && dto.delegates > 0) {
      const delegateResult = await this.generateCategoryPasses(
        PassCategory.DELEGATE,
        dto.delegates,
      );
      result.generated += delegateResult.count;
      result.categories.DELEGATE = delegateResult;
    }

    if (dto.vvip && dto.vvip > 0) {
      const vvipResult = await this.generateCategoryPasses(
        PassCategory.VVIP,
        dto.vvip,
      );
      result.generated += vvipResult.count;
      result.categories.VVIP = vvipResult;
    }

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

  private async generateCategoryPasses(
    category: PassCategory,
    count: number,
  ): Promise<{ count: number; range: string }> {
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

    await this.guestPassRepository.insert(passes);

    return {
      count,
      range: `${prefix}-${String(startSequence).padStart(3, '0')} to ${prefix}-${String(endSequence).padStart(3, '0')}`,
    };
  }

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

    // Check if mobile is already used (only if mobile is provided)
    if (dto.mobile) {
      const existingPass = await this.guestPassRepository.findOne({
        where: { mobile: dto.mobile },
      });

      if (existingPass) {
        throw new ConflictException(
          `Mobile ${dto.mobile} is already assigned to ${existingPass.qrCode}`,
        );
      }
    }

    // ✅ FIX: Handle null values properly
    pass.name = dto.name;
    pass.mobile = dto.mobile ?? undefined;
    pass.designation = dto.designation ?? undefined;
    pass.isAssigned = true;
    pass.assignedBy = dto.assignedBy || 'Admin';
    pass.assignedAt = new Date();

    return this.guestPassRepository.save(pass);
  }

  async bulkAssign(dto: BulkAssignDto): Promise<{
    success: number;
    failed: Array<{ qrCode: string; reason: string }>;
  }> {
    const result = {
      success: 0,
      failed: [] as Array<{ qrCode: string; reason: string }>,
    };

    for (const assignment of dto.assignments) {
      try {
        const pass = await this.guestPassRepository.findOne({
          where: { qrCode: assignment.qrCode },
        });

        if (!pass) {
          result.failed.push({
            qrCode: assignment.qrCode,
            reason: 'Pass not found',
          });
          continue;
        }

        if (pass.isAssigned) {
          result.failed.push({
            qrCode: assignment.qrCode,
            reason: `Already assigned to ${pass.name}`,
          });
          continue;
        }

        // Check mobile uniqueness (only if provided)
        if (assignment.mobile) {
          const existingPass = await this.guestPassRepository.findOne({
            where: { mobile: assignment.mobile },
          });

          if (existingPass && existingPass.qrCode !== assignment.qrCode) {
            result.failed.push({
              qrCode: assignment.qrCode,
              reason: `Mobile ${assignment.mobile} already used by ${existingPass.qrCode}`,
            });
            continue;
          }
        }

        // ✅ FIX: Handle null values properly
        pass.name = assignment.name;
        pass.mobile = assignment.mobile ?? undefined;
        pass.designation = assignment.designation ?? undefined;
        pass.isAssigned = true;
        pass.assignedBy = dto.assignedBy;
        pass.assignedAt = new Date();

        await this.guestPassRepository.save(pass);
        result.success++;
      } catch (error) {
        result.failed.push({
          qrCode: assignment.qrCode,
          reason: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

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

    const checkIn = this.guestCheckInRepository.create({
      type: checkInType,
      guestPassId: pass.id,
      scannedBy: scannedBy || 'Volunteer',
    });

    await this.guestCheckInRepository.save(checkIn);

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
      assignmentPercentage: totalPasses > 0 
        ? ((totalAssigned / totalPasses) * 100).toFixed(1) 
        : '0.0',
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

  async getAllPassesForExport(): Promise<GuestPass[]> {
    return this.guestPassRepository.find({
      relations: ['checkIns'],
      order: {
        category: 'ASC',
        sequenceNumber: 'ASC',
      },
    });
  }

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