import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Registration } from './entities/registrations.entity';

@Injectable()
export class RegistrationCacheService implements OnModuleInit {
  private redis: Redis;
  private readonly TTL = 86400; // 24 hours

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis cache service initialized');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  }

  async onModuleInit() {
    // Optional: Pre-load cache on startup (can be slow with large datasets)
    // await this.preloadAllRegistrations();
  }

  async getByQrCode(qrCode: string): Promise<any> {
    try {
      const cached = await this.redis.get(`reg:${qrCode}`);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
      });

      if (registration) {
        const cacheData = {
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
          delegateName: registration.delegateName,
          delegateMobile: registration.delegateMobile,
          delegateGender: registration.delegateGender,
          isDelegateAttending: registration.isDelegateAttending,
          hasEntryCheckIn: registration.hasEntryCheckIn,
          hasLunchCheckIn: registration.hasLunchCheckIn,
          hasDinnerCheckIn: registration.hasDinnerCheckIn,
          hasSessionCheckIn: registration.hasSessionCheckIn,
        };

        await this.redis.setex(
          `reg:${qrCode}`,
          this.TTL,
          JSON.stringify(cacheData),
        );

        return cacheData;
      }

      return null;
    } catch (error) {
      console.error('❌ Cache lookup failed:', error);
      
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
      });
      
      return registration;
    }
  }

  async updateCheckInStatus(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session',
  ): Promise<void> {
    try {
      const cached = await this.redis.get(`reg:${qrCode}`);
      
      if (cached) {
        const registration = JSON.parse(cached);
        
        const statusMap = {
          entry: 'hasEntryCheckIn',
          lunch: 'hasLunchCheckIn',
          dinner: 'hasDinnerCheckIn',
          session: 'hasSessionCheckIn',
        };

        registration[statusMap[checkInType]] = true;

        await this.redis.setex(
          `reg:${qrCode}`,
          this.TTL,
          JSON.stringify(registration),
        );
      }
    } catch (error) {
      console.error('❌ Cache update failed:', error);
    }
  }

  async invalidateRegistration(qrCode: string): Promise<void> {
    try {
      await this.redis.del(`reg:${qrCode}`);
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
    }
  }

  async preloadAllRegistrations(): Promise<void> {
    console.log('🔄 Pre-loading all registrations into cache...');
    
    try {
      const registrations = await this.registrationRepository.find();
      
      console.log(`📦 Found ${registrations.length} registrations to cache`);

      const pipeline = this.redis.pipeline();

      for (const registration of registrations) {
        const cacheData = {
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
          delegateName: registration.delegateName,
          delegateMobile: registration.delegateMobile,
          delegateGender: registration.delegateGender,
          isDelegateAttending: registration.isDelegateAttending,
          hasEntryCheckIn: registration.hasEntryCheckIn,
          hasLunchCheckIn: registration.hasLunchCheckIn,
          hasDinnerCheckIn: registration.hasDinnerCheckIn,
          hasSessionCheckIn: registration.hasSessionCheckIn,
        };

        pipeline.setex(
          `reg:${registration.qrCode}`,
          this.TTL,
          JSON.stringify(cacheData),
        );
      }

      await pipeline.exec();
      
      console.log('✅ Cache pre-load complete');
    } catch (error) {
      console.error('❌ Cache pre-load failed:', error);
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
}