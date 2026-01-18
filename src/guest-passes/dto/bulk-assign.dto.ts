import { IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class BulkAssignmentItem {
  @ApiProperty({ example: 'DELEGATE-001' })
  @IsString()
  qrCode: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: '9876543210', required: false })
  mobile?: string;

  @ApiProperty({ example: 'CEO', required: false })
  designation?: string;
}

export class BulkAssignDto {
  @ApiProperty({ type: [BulkAssignmentItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAssignmentItem)
  assignments: BulkAssignmentItem[];

  @ApiProperty({ example: 'Admin' })
  @IsString()
  assignedBy: string;
}