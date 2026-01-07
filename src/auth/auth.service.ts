import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string; // volunteer ID
  mobile: string;
  email: string;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  // ✅ Generate JWT token
  generateToken(volunteer: any): string {
    const payload: JwtPayload = {
      sub: volunteer.id,
      mobile: volunteer.mobile,
      email: volunteer.email,
      status: volunteer.status,
    };

    return this.jwtService.sign(payload);
  }

  // ✅ Verify token
  async verifyToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verify(token);
  }
}