import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as XLSX from 'xlsx';
import { GuestPassesService } from './guest-passes.service';
import { GuestExportService } from './guest-export.service';
import { GuestPDFService } from './guest-pdf.service';
import { GeneratePassesDto } from './dto/generate-passes.dto';
import { AssignDetailsDto } from './dto/assign-details.dto';
import { GuestCheckInDto } from './dto/guest-checkin.dto';
import { PassCategory } from './enums/pass-category.enum';

// ✅ Define inline interface to avoid unused import warning
interface BulkAssignmentItem {
  qrCode: string;
  name: string;
  mobile?: string;
  designation?: string;
}

@ApiTags('Guest Passes')
@Controller('guest-passes')
export class GuestPassesController {
  constructor(
    private readonly guestPassesService: GuestPassesService,
    private readonly exportService: GuestExportService,
    private readonly pdfService: GuestPDFService,
  ) {}

  // ============================================
  // EXPORT ROUTES
  // ============================================

  @Get('export/csv')
  @ApiOperation({ summary: '📄 Export all guest passes to CSV' })
  async exportToCSV(@Res() res: Response) {
    try {
      const passes = await this.guestPassesService.getAllPassesForExport();
      const csv = await this.exportService.generateCSV(passes);

      const filename = `Guest_Passes_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ error: 'Failed to generate CSV' });
    }
  }

  @Get('export/excel')
  @ApiOperation({ summary: '📊 Export all guest passes to Excel with QR codes' })
  async exportToExcel(@Res() res: Response) {
    try {
      const passes = await this.guestPassesService.getAllPassesForExport();
      const excelBuffer = await this.exportService.generateExcel(passes);

      const filename = `Guest_Passes_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel' });
    }
  }

  @Get('export/qr-pdf')
  @ApiOperation({ summary: '🎫 Export QR code labels PDF' })
  async exportQRPDF(@Res() res: Response) {
    try {
      const passes = await this.guestPassesService.getAllPassesForExport();
      
      if (passes.length === 0) {
        return res.status(404).json({ 
          error: 'No guest passes found',
          message: 'Please generate guest passes first'
        });
      }

      const pdfBuffer = await this.pdfService.generateQRCodePDF(passes);

      const filename = `Guest_QR_Codes_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('QR PDF export error:', error);
      res.status(500).json({ 
        error: 'Failed to generate QR PDF',
        message: error.message
      });
    }
  }

  // ============================================
  // STATISTICS ROUTE
  // ============================================

  @Get('statistics')
  @ApiOperation({ summary: '📊 Get guest pass statistics' })
  @ApiQuery({
    name: 'includeBreakdown',
    required: false,
    type: Boolean,
  })
  async getStatistics(@Query('includeBreakdown') includeBreakdown?: string) {
    const includeBreak = includeBreakdown === 'true';
    return this.guestPassesService.getStatistics(includeBreak);
  }

  // ============================================
  // GENERAL ROUTES
  // ============================================

  @Post('generate')
  @ApiOperation({ summary: '🎫 Generate guest passes' })
  @ApiBody({ type: GeneratePassesDto })
  async generatePasses(@Body() dto: GeneratePassesDto) {
    return this.guestPassesService.generatePasses(dto);
  }

  @Get()
  @ApiOperation({ summary: '📋 Get all guest passes with filters' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: PassCategory,
  })
  @ApiQuery({
    name: 'isAssigned',
    required: false,
    type: Boolean,
  })
  async getAllPasses(
    @Query('category') category?: PassCategory,
    @Query('isAssigned') isAssigned?: string,
  ) {
    const filters: any = {};

    if (category) {
      filters.category = category;
    }

    if (isAssigned !== undefined) {
      filters.isAssigned = isAssigned === 'true';
    }

    return this.guestPassesService.getAllPasses(filters);
  }

  // ============================================
  // ✅ BULK ASSIGNMENT FROM EXCEL
  // ============================================

  @Post('bulk-assign')
  @ApiOperation({ 
    summary: '📤 Bulk assign details from Excel',
    description: 'Upload Excel with columns: qrCode, name, mobile (optional), designation (optional)'
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkAssign(
    @UploadedFile() file: Express.Multer.File,
    @Body('assignedBy') assignedBy: string = 'Admin',
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      // ✅ Validate and transform data using inline interface
      const assignments: BulkAssignmentItem[] = data.map((row, index) => {
        if (!row.qrCode || !row.name) {
          throw new BadRequestException(
            `Row ${index + 2}: qrCode and name are required`,
          );
        }

        return {
          qrCode: String(row.qrCode).trim(),
          name: String(row.name).trim(),
          mobile: row.mobile ? String(row.mobile).trim() : undefined,
          designation: row.designation ? String(row.designation).trim() : undefined,
        };
      });

      // ✅ Call service method with properly typed data
      const result = await this.guestPassesService.bulkAssign({
        assignments,
        assignedBy,
      });

      return {
        message: 'Bulk assignment completed',
        total: assignments.length,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel: ${error.message}`,
      );
    }
  }

  // ============================================
  // PARAMETERIZED ROUTES
  // ============================================

  @Post('fast-checkin/:qrCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '⚡ Fast check-in for guest passes' })
  @ApiParam({
    name: 'qrCode',
    example: 'DELEGATE-001',
  })
  async fastCheckIn(
    @Param('qrCode') qrCode: string,
    @Body() dto: GuestCheckInDto,
  ) {
    return this.guestPassesService.fastCheckIn(
      qrCode,
      dto.type,
      dto.scannedBy,
    );
  }

  @Post(':qrCode/assign')
  @ApiOperation({ summary: '📝 Assign details to a guest pass' })
  @ApiParam({
    name: 'qrCode',
    example: 'DELEGATE-001',
  })
  async assignDetails(
    @Param('qrCode') qrCode: string,
    @Body() dto: AssignDetailsDto,
  ) {
    return this.guestPassesService.assignDetails(qrCode, dto);
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: '🔍 Get guest pass by QR code' })
  @ApiParam({
    name: 'qrCode',
    example: 'DELEGATE-001',
  })
  async getByQrCode(@Param('qrCode') qrCode: string) {
    return this.guestPassesService.getByQrCode(qrCode);
  }
}