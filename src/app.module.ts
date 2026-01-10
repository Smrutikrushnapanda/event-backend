import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegistrationsModule } from './registrations/registrations.module';
import 'dotenv/config';
import { VolunteersModule } from './volunteers/volunteers.module';
import { AuthModule } from './auth/auth.module';
import { GuestPassesModule } from './guest-passes/guest-passes.module';
import { UniversalCheckInModule } from './common/universal-checkin.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
      
      extra: {
        max: 30,
        min: 5,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 1800000,
        query_timeout: 60000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      },
    }),
    RegistrationsModule,
    VolunteersModule,
    AuthModule,
    GuestPassesModule,
    UniversalCheckInModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}