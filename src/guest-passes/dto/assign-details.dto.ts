import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignDetailsDto {
  @ApiProperty({
    description: 'Name of the person',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    description: 'Mobile number (10 digits)',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile must be a valid 10-digit Indian number',
  })
  mobile: string;

  @ApiProperty({
    description: 'Who assigned these details',
    example: 'Admin',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  assignedBy: string;
}