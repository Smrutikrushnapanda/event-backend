// src/registrations/registration-cache.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import Redis from 'ioredis';

@Injectable()
export class RegistrationCacheService implements OnModuleInit {
  private redis: Redis;
  private readonly CACHE_PREFIX = 'reg:';
  private readonly CACHE_TTL = 3600 * 24; // 24 hours

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
  ) {
    // Initialize Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
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
      console.log('✅ Redis connected successfully');
    });
  }

  async onModuleInit() {
    console.log('🚀 Initializing registration cache...');
    await this.preloadAllRegistrations();
  }

  /**
   * Get registration by QR code from cache
   */
  async getByQrCode(qrCode: string): Promise<any | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${qrCode}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        console.log('✅ Cache hit for QR:', qrCode);
        return JSON.parse(cached);
      }

      console.log('⚠️ Cache miss for QR:', qrCode);
      
      // Fetch from database and cache it
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });

      if (registration) {
        await this.cacheRegistration(registration);
        return this.transformRegistration(registration);
      }

      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache a single registration
   */
  async cacheRegistration(registration: Registration): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${registration.qrCode}`;
      const transformed = this.transformRegistration(registration);
      
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(transformed)
      );

      console.log('✅ Cached registration:', registration.qrCode);
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  /**
   * Update check-in status in cache
   */
  async updateCheckInStatus(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session'
  ): Promise<void> {
    try {
      const cached = await this.getByQrCode(qrCode);
      
      if (cached) {
        const checkInStatusMap = {
          entry: 'hasEntryCheckIn',
          lunch: 'hasLunchCheckIn',
          dinner: 'hasDinnerCheckIn',
          session: 'hasSessionCheckIn',
        };

        cached[checkInStatusMap[checkInType]] = true;

        const cacheKey = `${this.CACHE_PREFIX}${qrCode}`;
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(cached)
        );

        console.log(`✅ Updated ${checkInType} status for:`, qrCode);
      }
    } catch (error) {
      console.error('❌ Cache update error:', error);
    }
  }

  /**
   * Invalidate (delete) registration from cache
   */
  async invalidateRegistration(qrCode: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${qrCode}`;
      await this.redis.del(cacheKey);
      console.log('✅ Invalidated cache for:', qrCode);
    } catch (error) {
      console.error('❌ Cache invalidation error:', error);
    }
  }

  /**
   * Preload all registrations into cache
   */
  async preloadAllRegistrations(): Promise<void> {
    try {
      console.log('🔄 Preloading all registrations into cache...');
      
      const registrations = await this.registrationRepository.find({
        relations: ['checkIns'],
      });

      console.log(`📦 Found ${registrations.length} registrations to cache`);

      // Batch cache operations
      const pipeline = this.redis.pipeline();

      for (const registration of registrations) {
        const cacheKey = `${this.CACHE_PREFIX}${registration.qrCode}`;
        const transformed = this.transformRegistration(registration);
        
        pipeline.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(transformed)
        );
      }

      await pipeline.exec();

      console.log('✅ Cache preload complete');
    } catch (error) {
      console.error('❌ Cache preload error:', error);
    }
  }

  /**
   * Clear all cached registrations
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} cached registrations`);
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('❌ Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Transform registration entity to cache-friendly format
   */
  private transformRegistration(registration: Registration): any {
    const checkInTypes = ['entry', 'lunch', 'dinner', 'session'] as const;
    
    const hasCheckedIn: Record<string, boolean> = {};
    
    for (const type of checkInTypes) {
      hasCheckedIn[`has${type.charAt(0).toUpperCase() + type.slice(1)}CheckIn`] = 
        registration.checkIns?.some(c => c.type === type) || false;
    }

    return {
      id: registration.id,
      name: registration.name,
      mobile: registration.mobile,
      village: registration.village,
      district: registration.district,
      block: registration.block,
      category: registration.category,
      gender: registration.gender,
      caste: registration.caste,
      qrCode: registration.qrCode,
      behalfName: registration.behalfName,
      behalfMobile: registration.behalfMobile,
      behalfGender: registration.behalfGender,
      isBehalfAttending: registration.isBehalfAttending,
      ...hasCheckedIn,
    };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
    hits: number;
    misses: number;
  }> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      const info = await this.redis.info('stats');
      
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = info.match(/used_memory_human:(.+)/);

      return {
        totalKeys: keys.length,
        memoryUsed: memoryMatch ? memoryMatch[1] : 'N/A',
        hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
        misses: missesMatch ? parseInt(missesMatch[1]) : 0,
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return {
        totalKeys: 0,
        memoryUsed: 'N/A',
        hits: 0,
        misses: 0,
      };
    }
  }
}