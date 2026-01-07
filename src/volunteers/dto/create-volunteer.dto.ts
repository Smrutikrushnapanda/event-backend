import { IsNotEmpty, IsEmail, IsMobilePhone, IsString, IsInt, Min, Max, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateVolunteerDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '9876543210', description: '10-digit mobile number' })
  @IsMobilePhone('en-IN')
  mobile: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 25, description: 'Age (18-70)' })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(18)
  @Max(70)
  age: number;

  @ApiProperty({ example: 'Male', description: 'Gender' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: 'Khordha', description: 'District' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Bhubaneswar', description: 'Block' })
  @IsString()
  @IsNotEmpty()
  block: string;

  @ApiProperty({ example: '123 Main Street', description: 'Full address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Health & Family Welfare', description: 'Department preference' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: 'Volunteered at Red Cross for 2 years', description: 'Previous experience' })
  @IsString()
  @IsNotEmpty()
  experience: string;

  @ApiProperty({ example: 'MyPassword123', description: 'Password (minimum 6 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}