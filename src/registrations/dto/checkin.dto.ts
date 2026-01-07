import { IsString, IsOptional, IsIn } from 'class-validator';

export class CheckInDto {
  @IsString()
  @IsIn(['entry', 'lunch', 'dinner', 'kit'])
  type: string;

  @IsString()
  @IsOptional()
  scannedBy?: string;
}