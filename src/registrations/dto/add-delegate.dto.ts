import { IsNotEmpty, IsString, IsEnum, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddDelegateDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Delegate name' })
  @IsString()
  @IsNotEmpty({ message: 'Delegate name is required' })
  delegateName: string;

  @ApiProperty({ example: '9876543210', description: 'Delegate mobile number' })
  @IsString()
  @IsNotEmpty({ message: 'Delegate mobile number is required' })
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  delegateMobile: string;

  @ApiProperty({ 
    example: 'female', 
    description: 'Delegate gender',
    enum: ['male', 'female', 'others']
  })
  @IsEnum(['male', 'female', 'others'], { message: 'Gender must be male, female, or others' })
  @IsNotEmpty({ message: 'Delegate gender is required' })
  delegateGender: 'male' | 'female' | 'others';
}