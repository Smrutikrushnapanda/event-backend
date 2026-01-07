import { IsIn, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CheckInDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['entry', 'lunch', 'dinner', 'session'])
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @IsOptional()
  @IsString()
  scannedBy?: string;

  @IsOptional()
  @IsBoolean()
  wasDelegate?: boolean;
}