import { IsNotEmpty, IsString, IsMobilePhone } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginVolunteerDto {
  @ApiProperty({ example: '9876543210', description: 'Mobile number (10 digits)' })
  @IsMobilePhone('en-IN')
  mobile: string;

  @ApiProperty({ example: 'MyPassword123', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
