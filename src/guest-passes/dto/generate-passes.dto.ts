import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GeneratePassesDto {
  @ApiProperty({
    description: 'Number of DELEGATE passes to generate',
    example: 500,
    minimum: 1,
    maximum: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  delegates?: number;

  @ApiProperty({
    description: 'Number of VVIP passes to generate',
    example: 100,
    minimum: 1,
    maximum: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  vvip?: number;

  @ApiProperty({
    description: 'Number of VISITOR passes to generate',
    example: 1000,
    minimum: 1,
    maximum: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  visitors?: number;
}