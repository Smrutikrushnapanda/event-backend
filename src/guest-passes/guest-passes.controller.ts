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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GuestPassesService } from './guest-passes.service';
import { GuestExportService } from './guest-export.service';
import { GuestPDFService } from './guest-pdf.service';
import { GeneratePassesDto } from './dto/generate-passes.dto';
import { AssignDetailsDto } from './dto/assign-details.dto';
import { GuestCheckInDto } from './dto/guest-checkin.dto';
import { PassCategory } from './enums/pass-category.enum';

@ApiTags('Guest Passes')
@Controller('guest-passes')
export class GuestPassesController {
  constructor(
    private readonly guestPassesService: GuestPassesService,
    private readonly exportService: GuestExportService,
    private readonly pdfService: GuestPDFService,
  ) {}

  // ============================================
  // EXPORT ROUTES - MUST COME FIRST!
  // ============================================

  @Get('export/csv')
  @ApiOperation({ summary: '📄 Export all guest passes to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file generated' })
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
  @ApiResponse({ status: 200, description: 'Excel file generated' })
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
@ApiOperation({ summary: '🎫 Export QR code labels PDF (10mm x 10mm)' })
@ApiResponse({ status: 200, description: 'PDF with QR labels generated' })
async exportQRPDF(@Res() res: Response) {
  try {
    console.log('📥 Fetching guest passes for PDF export...');
    const passes = await this.guestPassesService.getAllPassesForExport();
    
    console.log(`📊 Found ${passes.length} guest passes`);
    
    if (passes.length === 0) {
      return res.status(404).json({ 
        error: 'No guest passes found',
        message: 'Please generate guest passes first using POST /guest-passes/generate'
      });
    }

    console.log('📄 Generating PDF...');
    const pdfBuffer = await this.pdfService.generateQRCodePDF(passes);

    const filename = `Guest_QR_Codes_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
    
    console.log('✅ PDF sent successfully');
  } catch (error) {
    console.error('❌ QR PDF export error:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR PDF',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

  @Get('export/excel/:category')
  @ApiOperation({ summary: '📊 Export passes by category to Excel' })
  @ApiParam({
    name: 'category',
    enum: PassCategory,
    example: 'DELEGATE',
  })
  @ApiResponse({ status: 200, description: 'Excel file generated' })
  async exportCategoryToExcel(
    @Param('category') category: PassCategory,
    @Res() res: Response,
  ) {
    try {
      const passes =
        await this.guestPassesService.getPassesByCategoryForExport(category);
      const excelBuffer = await this.exportService.generateExcel(passes);

      const filename = `${category}_Passes_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error('Category Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel' });
    }
  }

  @Get('export/qr-pdf/:category')
  @ApiOperation({ summary: '🎫 Export QR labels PDF by category' })
  @ApiParam({
    name: 'category',
    enum: PassCategory,
    example: 'DELEGATE',
  })
  @ApiResponse({ status: 200, description: 'PDF generated' })
  async exportCategoryQRPDF(
    @Param('category') category: PassCategory,
    @Res() res: Response,
  ) {
    try {
      const passes =
        await this.guestPassesService.getPassesByCategoryForExport(category);
      const pdfBuffer = await this.pdfService.generateQRCodePDF(passes);

      const filename = `${category}_QR_Codes_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Category QR PDF export error:', error);
      res.status(500).json({ error: 'Failed to generate QR PDF' });
    }
  }

  // ============================================
  // STATISTICS ROUTE - BEFORE PARAMETERIZED ROUTES
  // ============================================

  @Get('statistics')
  @ApiOperation({ summary: '📊 Get guest pass statistics' })
  @ApiQuery({
    name: 'includeBreakdown',
    required: false,
    type: Boolean,
    description: 'Include category-wise breakdown',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns comprehensive statistics',
  })
  async getStatistics(@Query('includeBreakdown') includeBreakdown?: string) {
    const includeBreak = includeBreakdown === 'true';
    return this.guestPassesService.getStatistics(includeBreak);
  }

  // ============================================
  // GENERAL ROUTES
  // ============================================

  @Post('generate')
  @ApiOperation({
    summary: '🎫 Generate guest passes (DELEGATE/VVIP/VISITOR)',
    description:
      'Generate pre-numbered QR codes. Continues from last number if called again.',
  })
  @ApiBody({ type: GeneratePassesDto })
  @ApiResponse({
    status: 201,
    description: 'Passes generated successfully',
  })
  async generatePasses(@Body() dto: GeneratePassesDto) {
    return this.guestPassesService.generatePasses(dto);
  }

  @Get()
  @ApiOperation({ summary: '📋 Get all guest passes with optional filters' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: PassCategory,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'isAssigned',
    required: false,
    type: Boolean,
    description: 'Filter by assignment status',
  })
  @ApiResponse({ status: 200, description: 'Returns list of guest passes' })
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
  // PARAMETERIZED ROUTES - MUST COME LAST!
  // ============================================

  @Post('fast-checkin/:qrCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '⚡ Fast check-in for guest passes',
    description: 'Anonymous check-in - no personal details required',
  })
  @ApiParam({
    name: 'qrCode',
    example: 'DELEGATE-001',
    description: 'Guest pass QR code',
  })
  @ApiResponse({ status: 200, description: 'Check-in processed' })
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
  @ApiOperation({
    summary: '📝 Assign name and mobile to a guest pass',
    description: 'Add personal details to a QR code later',
  })
  @ApiParam({
    name: 'qrCode',
    example: 'DELEGATE-001',
    description: 'Guest pass QR code',
  })
  @ApiResponse({ status: 200, description: 'Details assigned successfully' })
  @ApiResponse({ status: 404, description: 'Guest pass not found' })
  @ApiResponse({
    status: 409,
    description: 'Pass already assigned or mobile already used',
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
    description: 'Guest pass QR code',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns guest pass with check-in history',
  })
  @ApiResponse({ status: 404, description: 'Guest pass not found' })
  async getByQrCode(@Param('qrCode') qrCode: string) {
    return this.guestPassesService.getByQrCode(qrCode);
  }
}