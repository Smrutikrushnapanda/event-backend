import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { VolunteersService } from '../volunteers/volunteers.service';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private volunteersService: VolunteersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const volunteer = await this.volunteersService.findById(payload.sub);

    if (!volunteer) {
      throw new UnauthorizedException('Invalid token');
    }

    if (volunteer.status !== 'approved') {
      throw new UnauthorizedException('Account not approved');
    }

    return volunteer; // This will be available in request.user
  }
}