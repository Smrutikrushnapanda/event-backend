import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import Redis from 'ioredis';

@Injectable()
export class RegistrationCacheService implements OnModuleInit {
  private redis: Redis;
  
  private readonly CACHE_TTL = 60 * 60 * 24 * 7;
  private readonly QR_KEY_PREFIX = 'qr:';
  
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
  }

  async onModuleInit() {
    console.log('✅ Redis cache service initialized');
  }

  async preloadAllRegistrations(): Promise<void> {
    console.log('📦 Starting registration cache pre-load...');
    
    const startTime = Date.now();
    const batchSize = 1000;
    let page = 0;
    let totalLoaded = 0;
    
    while (true) {
      const registrations = await this.registrationRepository.find({
        skip: page * batchSize,
        take: batchSize,
        relations: ['checkIns'],
      });
      
      if (registrations.length === 0) break;
      
      const pipeline = this.redis.pipeline();
      
      for (const reg of registrations) {
        const cacheData = {
          id: reg.id,
          qrCode: reg.qrCode,
          name: reg.name,
          village: reg.village,
          block: reg.block,
          district: reg.district,
          mobile: reg.mobile,
          category: reg.category,
          photoUrl: reg.photoUrl,
          delegateName: reg.delegateName,
          isDelegateAttending: reg.isDelegateAttending,
          hasEntryCheckIn: reg.checkIns.some(c => c.type === 'entry'),
          hasLunchCheckIn: reg.checkIns.some(c => c.type === 'lunch'),
          hasDinnerCheckIn: reg.checkIns.some(c => c.type === 'dinner'),
          hasSessionCheckIn: reg.checkIns.some(c => c.type === 'session'),
        };
        
        pipeline.setex(
          `${this.QR_KEY_PREFIX}${reg.qrCode}`,
          this.CACHE_TTL,
          JSON.stringify(cacheData)
        );
      }
      
      await pipeline.exec();
      totalLoaded += registrations.length;
      console.log(`📦 Loaded ${totalLoaded} registrations into cache...`);
      page++;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Cache pre-load complete: ${totalLoaded} registrations in ${duration}s`);
  }

  async getByQrCode(qrCode: string): Promise<any | null> {
    try {
      const cached = await this.redis.get(`${this.QR_KEY_PREFIX}${qrCode}`);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      console.log(`⚠️ Cache miss for QR: ${qrCode}`);
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });
      
      if (!registration) return null;
      
      const cacheData = {
        id: registration.id,
        qrCode: registration.qrCode,
        name: registration.name,
        village: registration.village,
        block: registration.block,
        district: registration.district,
        mobile: registration.mobile,
        category: registration.category,
        photoUrl: registration.photoUrl,
        delegateName: registration.delegateName,
        isDelegateAttending: registration.isDelegateAttending,
        hasEntryCheckIn: registration.checkIns.some(c => c.type === 'entry'),
        hasLunchCheckIn: registration.checkIns.some(c => c.type === 'lunch'),
        hasDinnerCheckIn: registration.checkIns.some(c => c.type === 'dinner'),
        hasSessionCheckIn: registration.checkIns.some(c => c.type === 'session'),
      };
      
      await this.redis.setex(
        `${this.QR_KEY_PREFIX}${qrCode}`,
        this.CACHE_TTL,
        JSON.stringify(cacheData)
      );
      
      return cacheData;
    } catch (error) {
      console.error('❌ Cache lookup error:', error);
      return this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });
    }
  }

  async updateCheckInStatus(qrCode: string, checkInType: string): Promise<void> {
    try {
      const cached = await this.redis.get(`${this.QR_KEY_PREFIX}${qrCode}`);
      
      if (cached) {
        const data = JSON.parse(cached);
        
        if (checkInType === 'entry') data.hasEntryCheckIn = true;
        if (checkInType === 'lunch') data.hasLunchCheckIn = true;
        if (checkInType === 'dinner') data.hasDinnerCheckIn = true;
        if (checkInType === 'session') data.hasSessionCheckIn = true;
        
        await this.redis.setex(
          `${this.QR_KEY_PREFIX}${qrCode}`,
          this.CACHE_TTL,
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.error('❌ Cache update error:', error);
    }
  }

  async invalidateRegistration(qrCode: string): Promise<void> {
    await this.redis.del(`${this.QR_KEY_PREFIX}${qrCode}`);
  }

  async clearAllCache(): Promise<void> {
    const keys = await this.redis.keys(`${this.QR_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    console.log(`🗑️ Cleared ${keys.length} cached registrations`);
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