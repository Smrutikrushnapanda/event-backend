import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import Redis from 'ioredis';

@Injectable()
export class RegistrationCacheService implements OnModuleInit {
  private redis: Redis;
  private readonly CACHE_PREFIX = 'reg:';
  private readonly CACHE_TTL = 86400; // 24 hours

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis cache service initialized');
    });
  }

  async onModuleInit() {
    await this.preloadAllRegistrations();
  }

  async preloadAllRegistrations(): Promise<void> {
    try {
      console.log('🔄 Preloading registrations into cache...');
      
      const registrations = await this.registrationRepository.find({
        select: [
          'id',
          'qrCode',
          'name',
          'village',
          'district',
          'block',
          'mobile',
          'aadhaarOrId',
          'gender',
          'caste',
          'category',
          'behalfName',
          'behalfMobile',
          'behalfGender',
          'isBehalfAttending',
          'hasEntryCheckIn',
          'hasLunchCheckIn',
          'hasDinnerCheckIn',
          'hasSessionCheckIn',
          'createdAt',
        ],
      });

      const pipeline = this.redis.pipeline();
      
      for (const reg of registrations) {
        const key = this.getCacheKey(reg.qrCode);
        const data = {
          id: reg.id,
          qrCode: reg.qrCode,
          name: reg.name,
          village: reg.village,
          district: reg.district,
          block: reg.block,
          mobile: reg.mobile,
          aadhaarOrId: reg.aadhaarOrId,
          gender: reg.gender,
          caste: reg.caste,
          category: reg.category,
          behalfName: reg.behalfName,
          behalfMobile: reg.behalfMobile,
          behalfGender: reg.behalfGender,
          isBehalfAttending: reg.isBehalfAttending,
          hasEntryCheckIn: reg.hasEntryCheckIn,
          hasLunchCheckIn: reg.hasLunchCheckIn,
          hasDinnerCheckIn: reg.hasDinnerCheckIn,
          hasSessionCheckIn: reg.hasSessionCheckIn,
          createdAt: reg.createdAt,
        };
        
        pipeline.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL);
      }

      await pipeline.exec();
      
      console.log(`✅ Preloaded ${registrations.length} registrations into cache`);
    } catch (error) {
      console.error('❌ Failed to preload registrations:', error);
    }
  }

  async getByQrCode(qrCode: string): Promise<any | null> {
    try {
      const key = this.getCacheKey(qrCode);
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
        select: [
          'id',
          'qrCode',
          'name',
          'village',
          'district',
          'block',
          'mobile',
          'aadhaarOrId',
          'gender',
          'caste',
          'category',
          'behalfName',
          'behalfMobile',
          'behalfGender',
          'isBehalfAttending',
          'hasEntryCheckIn',
          'hasLunchCheckIn',
          'hasDinnerCheckIn',
          'hasSessionCheckIn',
          'createdAt',
        ],
      });

      if (registration) {
        const data = {
          id: registration.id,
          qrCode: registration.qrCode,
          name: registration.name,
          village: registration.village,
          district: registration.district,
          block: registration.block,
          mobile: registration.mobile,
          aadhaarOrId: registration.aadhaarOrId,
          gender: registration.gender,
          caste: registration.caste,
          category: registration.category,
          behalfName: registration.behalfName,
          behalfMobile: registration.behalfMobile,
          behalfGender: registration.behalfGender,
          isBehalfAttending: registration.isBehalfAttending,
          hasEntryCheckIn: registration.hasEntryCheckIn,
          hasLunchCheckIn: registration.hasLunchCheckIn,
          hasDinnerCheckIn: registration.hasDinnerCheckIn,
          hasSessionCheckIn: registration.hasSessionCheckIn,
          createdAt: registration.createdAt,
        };
        
        await this.redis.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL);
        
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache lookup error:', error);
      return null;
    }
  }

  async updateCheckInStatus(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session',
  ): Promise<void> {
    try {
      const key = this.getCacheKey(qrCode);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        const statusField = `has${checkInType.charAt(0).toUpperCase() + checkInType.slice(1)}CheckIn`;
        data[statusField] = true;
        
        await this.redis.set(key, JSON.stringify(data), 'EX', this.CACHE_TTL);
      }
    } catch (error) {
      console.error('❌ Failed to update check-in status in cache:', error);
    }
  }

  async invalidateRegistration(qrCode: string): Promise<void> {
    try {
      const key = this.getCacheKey(qrCode);
      await this.redis.del(key);
    } catch (error) {
      console.error('❌ Failed to invalidate cache:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private getCacheKey(qrCode: string): string {
    return `${this.CACHE_PREFIX}${qrCode}`;
  }
}