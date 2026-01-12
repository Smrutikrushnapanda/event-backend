import { IsNotEmpty, IsString, IsEnum, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddBehalfDto {
  @ApiProperty({ 
    description: 'Name of person attending on behalf',
    example: 'John Doe' 
  })
  @IsString()
  @IsNotEmpty()
  behalfName: string;

  @ApiProperty({ 
    description: '10-digit mobile number',
    example: '9876543210' 
  })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { 
    message: 'Invalid mobile number. Must be 10 digits starting with 6-9' 
  })
  behalfMobile: string;

  @ApiProperty({ 
    description: 'Gender of behalf person',
    enum: ['male', 'female', 'others'],
    example: 'male' 
  })
  @IsEnum(['male', 'female', 'others'])
  behalfGender: 'male' | 'female' | 'others';
}