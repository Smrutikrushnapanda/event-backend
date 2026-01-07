import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveVolunteerDto {
  @ApiProperty({ example: 'Admin Name', description: 'Name of admin approving' })
  @IsString()
  @IsNotEmpty()
  approvedBy: string;

  @ApiPropertyOptional({ example: 'Registration Desk', description: 'Role assigned to volunteer' })
  @IsString()
  @IsOptional()
  assignedRole?: string;
}

export class RejectVolunteerDto {
  @ApiProperty({ example: 'Admin Name', description: 'Name of admin rejecting' })
  @IsString()
  @IsNotEmpty()
  rejectedBy: string;

  @ApiPropertyOptional({ example: 'Incomplete information', description: 'Reason for rejection' })
  @IsString()
  @IsOptional()
  reason?: string;
}