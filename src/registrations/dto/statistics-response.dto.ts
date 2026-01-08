import { ApiProperty } from '@nestjs/swagger';

export class CheckInStatistics {
  @ApiProperty({ example: 450, description: 'Total number of entry check-ins' })
  entry: number;

  @ApiProperty({ example: 380, description: 'Total number of lunch check-ins' })
  lunch: number;

  @ApiProperty({ example: 320, description: 'Total number of dinner check-ins' })
  dinner: number;

  @ApiProperty({ example: 410, description: 'Total number of session check-ins' })
  session: number;

  @ApiProperty({ example: 1560, description: 'Total number of all check-ins' })
  total: number;
}

export class BlockWiseStatistics {
  @ApiProperty({ example: 'Bhubaneswar', description: 'Block name' })
  block: string;

  @ApiProperty({ example: 150, description: 'Total registrations in this block' })
  totalRegistrations: number;

  @ApiProperty({ example: 120, description: 'Total entry check-ins in this block' })
  entryCheckIns: number;

  @ApiProperty({ example: 100, description: 'Total lunch check-ins in this block' })
  lunchCheckIns: number;

  @ApiProperty({ example: 90, description: 'Total dinner check-ins in this block' })
  dinnerCheckIns: number;

  @ApiProperty({ example: 110, description: 'Total session check-ins in this block' })
  sessionCheckIns: number;
}

export class StatisticsResponseDto {
  @ApiProperty({ example: 500, description: 'Total number of registrations' })
  totalRegistrations: number;

  @ApiProperty({ example: 450, description: 'Total number of attendees (unique entry check-ins)' })
  totalAttendees: number;

  @ApiProperty({ example: 25, description: 'Number of delegates attending instead of original registrants' })
  totalDelegatesAttending: number;

  @ApiProperty({ 
    description: 'Breakdown of check-ins by type',
    type: CheckInStatistics 
  })
  checkIns: CheckInStatistics;

  @ApiProperty({ 
    description: 'Block-wise statistics',
    type: [BlockWiseStatistics],
    required: false
  })
  blockWiseStats?: BlockWiseStatistics[];

  @ApiProperty({ example: '2025-01-08T10:30:00.000Z', description: 'When these statistics were generated' })
  generatedAt: Date;
}