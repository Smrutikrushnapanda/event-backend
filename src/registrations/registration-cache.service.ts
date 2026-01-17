// src/registrations/registration-cache.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registrations.entity';
import Redis from 'ioredis';

@Injectable()
export class RegistrationCacheService implements OnModuleInit {
  private redis: Redis | null = null;
  private redisAvailable = false;
  private readonly CACHE_PREFIX = 'reg:';
  private readonly CACHE_TTL = 3600 * 24; // 24 hours

  constructor(
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
  ) {
    // ✅ FIXED: Only connect to Redis if URL is provided
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    
    if (redisUrl || redisHost) {
      try {
        console.log('🔄 Attempting Redis connection...');
        
        // ✅ FIXED: Proper Redis initialization
        if (redisUrl) {
          // Use connection URL
          this.redis = new Redis(redisUrl, {
            retryStrategy: (times) => {
              if (times > 3) {
                console.log('⚠️ Redis connection failed after 3 attempts, disabling cache');
                this.redisAvailable = false;
                return null;
              }
              return Math.min(times * 50, 2000);
            },
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          });
        } else {
          // Use host/port configuration
          this.redis = new Redis({
            host: redisHost || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            retryStrategy: (times) => {
              if (times > 3) {
                console.log('⚠️ Redis connection failed after 3 attempts, disabling cache');
                this.redisAvailable = false;
                return null;
              }
              return Math.min(times * 50, 2000);
            },
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          });
        }

        this.redis.on('error', (err) => {
          console.error('❌ Redis connection error:', err.message);
          this.redisAvailable = false;
        });

        this.redis.on('connect', () => {
          console.log('✅ Redis connected successfully');
          this.redisAvailable = true;
        });

        // Try to connect
        this.redis.connect().catch((err) => {
          console.warn('⚠️ Redis not available, using database only:', err.message);
          this.redisAvailable = false;
          this.redis = null;
        });
      } catch (error) {
        console.warn('⚠️ Redis initialization failed, using database only:', error.message);
        this.redis = null;
        this.redisAvailable = false;
      }
    } else {
      console.log('ℹ️ No Redis configuration found, using database only');
      this.redisAvailable = false;
    }
  }

  async onModuleInit() {
    console.log('🚀 Initializing registration cache service...');
    
    // ✅ FIXED: Only preload if Redis is available
    if (this.redisAvailable && this.redis) {
      await this.preloadAllRegistrations();
    } else {
      console.log('ℹ️ Caching disabled - using direct database queries');
    }
  }

  /**
   * Get registration by QR code from cache (or database if Redis unavailable)
   */
  async getByQrCode(qrCode: string): Promise<any | null> {
    try {
      // ✅ FIXED: If Redis unavailable, go straight to database
      if (!this.redisAvailable || !this.redis) {
        return await this.getFromDatabase(qrCode);
      }

      const cacheKey = `${this.CACHE_PREFIX}${qrCode}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        console.log('✅ Cache hit for QR:', qrCode);
        return JSON.parse(cached);
      }

      console.log('⚠️ Cache miss for QR:', qrCode);
      
      // Fetch from database and cache it
      const registration = await this.getFromDatabase(qrCode);

      if (registration && this.redisAvailable) {
        await this.cacheRegistration(registration);
      }

      return registration;
    } catch (error) {
      console.error('❌ Cache get error:', error.message);
      // ✅ FIXED: Fall back to database on error
      return await this.getFromDatabase(qrCode);
    }
  }

  /**
   * Get registration directly from database
   */
  private async getFromDatabase(qrCode: string): Promise<any | null> {
    try {
      const registration = await this.registrationRepository.findOne({
        where: { qrCode },
        relations: ['checkIns'],
      });

      if (registration) {
        return this.transformRegistration(registration);
      }

      return null;
    } catch (error) {
      console.error('❌ Database query error:', error);
      return null;
    }
  }

  /**
   * Cache a single registration
   */
  async cacheRegistration(registration: Registration): Promise<void> {
    // ✅ FIXED: Skip if Redis unavailable
    if (!this.redisAvailable || !this.redis) {
      return;
    }

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
      console.error('❌ Cache set error:', error.message);
    }
  }

  /**
   * Update check-in status in cache
   */
  async updateCheckInStatus(
    qrCode: string,
    checkInType: 'entry' | 'lunch' | 'dinner' | 'session'
  ): Promise<void> {
    // ✅ FIXED: Skip if Redis unavailable
    if (!this.redisAvailable || !this.redis) {
      return;
    }

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
      console.error('❌ Cache update error:', error.message);
    }
  }

  /**
   * Invalidate (delete) registration from cache
   */
  async invalidateRegistration(qrCode: string): Promise<void> {
    // ✅ FIXED: Skip if Redis unavailable
    if (!this.redisAvailable || !this.redis) {
      return;
    }

    try {
      const cacheKey = `${this.CACHE_PREFIX}${qrCode}`;
      await this.redis.del(cacheKey);
      console.log('✅ Invalidated cache for:', qrCode);
    } catch (error) {
      console.error('❌ Cache invalidation error:', error.message);
    }
  }

  /**
   * Preload all registrations into cache
   */
  async preloadAllRegistrations(): Promise<void> {
    // ✅ FIXED: Skip if Redis unavailable
    if (!this.redisAvailable || !this.redis) {
      return;
    }

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
      console.error('❌ Cache preload error:', error.message);
    }
  }

  /**
   * Clear all cached registrations
   */
  async clearCache(): Promise<void> {
    // ✅ FIXED: Skip if Redis unavailable
    if (!this.redisAvailable || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} cached registrations`);
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error.message);
    }
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.redisAvailable || !this.redis) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('❌ Redis health check failed:', error.message);
      this.redisAvailable = false;
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
    available: boolean;
  }> {
    if (!this.redisAvailable || !this.redis) {
      return {
        totalKeys: 0,
        memoryUsed: 'N/A',
        hits: 0,
        misses: 0,
        available: false,
      };
    }

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
        available: true,
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error.message);
      return {
        totalKeys: 0,
        memoryUsed: 'N/A',
        hits: 0,
        misses: 0,
        available: false,
      };
    }
  }
}