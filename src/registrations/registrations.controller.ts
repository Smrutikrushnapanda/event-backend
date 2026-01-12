import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Patch, 
  Query,
  NotFoundException,
  BadRequestException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RegistrationsService } from './registrations.service';
import { ExcelExportService } from './excel-export.service';
import { QRCodePDFService } from './qrcode-pdf.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/checkin.dto';
import { AddBehalfDto } from './dto/add-behalf.dto';
import { CheckIn } from './entities/checkin.entity';

@ApiTags('Registrations')
@Controller('registrations')
export class RegistrationsController {

  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly excelExportService: ExcelExportService,
    private readonly qrCodePDFService: QRCodePDFService,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new registration' })
  @ApiBody({ type: CreateRegistrationDto })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - mobile/aadhaar already registered' })
  create(@Body() dto: CreateRegistrationDto) {
    console.log('Received DTO:', dto);
    return this.registrationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all registrations' })
  @ApiResponse({ status: 200, description: 'Returns all registrations with check-ins' })
  getAll() {
    return this.registrationsService.findAll();
  }

  @Post('check-aadhaar')
  @ApiOperation({ summary: 'Check if Aadhaar number is already registered' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        aadhaarOrId: { type: 'string', example: '123456789012' },
      },
      required: ['aadhaarOrId'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns whether Aadhaar exists and QR code if found',
  })
  checkAadhaar(@Body('aadhaarOrId') aadhaarOrId: string) {
    return this.registrationsService.checkAadhaar(aadhaarOrId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get event statistics (registrations, check-ins, etc.)' })
  @ApiQuery({ 
    name: 'includeBlockWise', 
    required: false, 
    type: Boolean,
    description: 'Include block-wise breakdown in response',
    example: false 
  })
  @ApiResponse({ status: 200, description: 'Returns comprehensive event statistics' })
  async getStatistics(@Query('includeBlockWise') includeBlockWise?: string) {
    const includeBlocks = includeBlockWise === 'true';
    return this.registrationsService.getStatistics(includeBlocks);
  }

  @Get('export/stats')
  @ApiOperation({ summary: 'Get statistics for export planning' })
  @ApiResponse({ status: 200, description: 'Export statistics' })
  async getExportStats() {
    try {
      const registrations = await this.registrationsService.findAllForExport();
      
      const blockCounts: Record<string, number> = {};
      registrations.forEach(reg => {
        blockCounts[reg.block] = (blockCounts[reg.block] || 0) + 1;
      });

      const estimatedExcelSize = registrations.length * 10;
      const estimatedCSVSize = registrations.length * 0.2;

      return {
        totalRegistrations: registrations.length,
        totalBlocks: Object.keys(blockCounts).length,
        blockCounts,
        estimatedExcelSizeMB: Math.round(estimatedExcelSize / 1024),
        estimatedCSVSizeKB: Math.round(estimatedCSVSize),
        estimatedExcelTimeMinutes: Math.round(registrations.length / 100),
        recommendBlockWiseExport: registrations.length > 5000,
      };
    } catch (error) {
      console.error('Error getting export stats:', error);
      throw new BadRequestException('Failed to get export statistics');
    }
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export all registrations to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file generated successfully' })
  async exportToCSV(@Res() res: Response) {
    try {
      const registrations = await this.registrationsService.findAllForExport();
      
      console.log(`📦 Exporting ${registrations.length} registrations to CSV...`);

      const csv = await this.excelExportService.generateRegistrationsCSV(registrations);

      const filename = `MPSO_Registrations_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', csv.length.toString());

      res.send(csv);
      console.log('✅ CSV export sent successfully');
    } catch (error) {
      console.error('❌ CSV export error:', error);
      res.status(500).json({ error: 'Failed to generate CSV file' });
    }
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Export all registrations to Excel with QR codes' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  async exportToExcel(@Res() res: Response) {
    try {
      const registrations = await this.registrationsService.findAllForExport();
      
      console.log(`📦 Exporting ${registrations.length} registrations to Excel...`);

      const excelBuffer = await this.excelExportService.generateRegistrationsExcel(registrations);

      const filename = `MPSO_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length.toString());

      res.send(excelBuffer);
      console.log('✅ Excel export sent successfully');
    } catch (error) {
      console.error('❌ Export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  }

  @Get('export/excel/:blockName')
  @ApiOperation({ summary: 'Export block registrations to Excel with QR codes' })
  @ApiParam({ name: 'blockName', example: 'Bhubaneswar' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  async exportBlockToExcel(
    @Param('blockName') blockName: string,
    @Res() res: Response,
  ) {
    try {
      const registrations = await this.registrationsService.findByBlockForExport(blockName);

      console.log(`📦 Exporting ${registrations.length} registrations for ${blockName} block...`);

      const excelBuffer = await this.excelExportService.generateBlockExcel(registrations, blockName);

      const filename = `${blockName}_Block_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length.toString());

      res.send(excelBuffer);
      console.log('✅ Block excel export sent successfully');
    } catch (error) {
      console.error('❌ Block export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'Get registration by QR code with check-in status' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0', description: 'Unique QR code' })
  @ApiResponse({ status: 200, description: 'Returns registration details with check-in history' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async getByQr(@Param('qrCode') qrCode: string) {
    try {
      console.log('🔍 Controller: Looking up QR code:', qrCode);

      const registration = await this.registrationsService.findByQrCode(qrCode);
      
      if (!registration) {
        console.log('❌ Controller: Registration not found');
        throw new NotFoundException({
          statusCode: 404,
          message: 'Registration not found',
          error: 'Not Found',
          qrCode: qrCode,
        });
      }

      console.log('✅ Controller: Registration found:', registration.id, registration.name);

      const checkIns = await this.checkInRepository.find({
        where: { registration: { id: registration.id } },
        order: { scannedAt: 'ASC' },
      });

      console.log('✅ Controller: Found', checkIns.length, 'check-ins');

      const hasCheckedIn = {
        entry: checkIns.some(c => c.type === 'entry'),
        lunch: checkIns.some(c => c.type === 'lunch'),
        dinner: checkIns.some(c => c.type === 'dinner'),
        session: checkIns.some(c => c.type === 'session'),
      };

      return {
        id: registration.id,
        qrCode: registration.qrCode,
        name: registration.name,
        village: registration.village,
        district: registration.district,
        block: registration.block,
        mobile: registration.mobile,
        aadhaarOrId: registration.aadhaarOrId,
        gender: registration.gender,
        caste: registration.caste,
        category: registration.category,
        behalfName: registration.behalfName,
        behalfMobile: registration.behalfMobile,
        behalfGender: registration.behalfGender,
        isBehalfAttending: registration.isBehalfAttending,
        createdAt: registration.createdAt,
        hasCheckedIn,
        checkIns: checkIns.map(c => ({
          id: c.id,
          type: c.type,
          scannedAt: c.scannedAt,
          wasBehalf: c.wasBehalf,
        })),
      };
    } catch (error) {
      console.error('❌ Controller: Error in getByQr:', error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException({
        statusCode: 400,
        message: 'Failed to fetch registration',
        error: error.message,
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get registration by ID' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiResponse({ status: 200, description: 'Returns registration details' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  getById(@Param('id') id: string) {
    return this.registrationsService.findById(id);
  }

  @Post('checkin/:qrCode')
  @ApiOperation({ summary: 'Check-in for entry, lunch, dinner, or session' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0', description: 'Unique QR code' })
  @ApiBody({ type: CheckInDto })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Already checked in for this activity' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async checkIn(
    @Param('qrCode') qrCode: string,
    @Body() body: CheckInDto,
  ) {
    const validTypes = ['entry', 'lunch', 'dinner', 'session'];
    if (!validTypes.includes(body.type)) {
      throw new BadRequestException('Invalid activity type. Must be: entry, lunch, dinner, or session');
    }

    const registration = await this.registrationsService.findByQrCode(qrCode);
    
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const existingCheckIn = await this.checkInRepository.findOne({
      where: {
        registrationId: registration.id,
        type: body.type as 'entry' | 'lunch' | 'dinner' | 'session',
      },
    });

    if (existingCheckIn) {
      throw new BadRequestException(`${body.type} already marked`);
    }

    const checkIn = this.checkInRepository.create({
      type: body.type as 'entry' | 'lunch' | 'dinner' | 'session',
      registrationId: registration.id,
      scannedBy: body.scannedBy || 'System',
      wasBehalf: body.wasBehalf || false,
    });

    await this.checkInRepository.save(checkIn);

    return {
      message: `${body.type} marked successfully`,
      registration: {
        id: registration.id,
        name: registration.name,
        qrCode: registration.qrCode,
      },
      checkedInAt: checkIn.scannedAt,
    };
  }

  @Post(':id/delegate')
  @ApiOperation({ summary: 'Add behalf person to registration' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiBody({ type: AddBehalfDto })
  @ApiResponse({ status: 200, description: 'Behalf person added successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  addBehalf(
    @Param('id') id: string,
    @Body() dto: AddBehalfDto,
  ) {
    return this.registrationsService.addBehalf(id, dto);
  }

  @Patch(':id/delegate/toggle')
  @ApiOperation({ summary: 'Toggle between original farmer and behalf person attendance' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiQuery({ 
    name: 'isBehalfAttending', 
    type: 'boolean', 
    example: true,
    description: 'True if behalf person is attending, false for original farmer' 
  })
  @ApiResponse({ status: 200, description: 'Attendance toggled successfully' })
  @ApiResponse({ status: 400, description: 'No behalf person registered' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  toggleBehalf(
    @Param('id') id: string,
    @Query('isBehalfAttending') isBehalfAttending: string,
  ) {
    return this.registrationsService.toggleBehalf(id, isBehalfAttending === 'true');
  }

  @Get(':id/checkins')
  @ApiOperation({ summary: 'Get all check-ins for a registration' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiResponse({ status: 200, description: 'Returns check-in history with summary' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  getCheckIns(@Param('id') id: string) {
    return this.registrationsService.getCheckIns(id);
  }

  @Get('export/qr-pdf')
  @ApiOperation({ summary: 'Export all registrations as QR code labels PDF (10mm x 10mm)' })
  @ApiResponse({ status: 200, description: 'PDF with QR code labels generated successfully' })
  async exportQRCodePDF(@Res() res: Response) {
    try {
      const registrations = await this.registrationsService.findAllForExport();
      
      console.log(`📄 Generating QR code PDF for ${registrations.length} registrations...`);

      const pdfBuffer = await this.qrCodePDFService.generateQRCodePDF(registrations);

      const filename = `MPSO_QR_Codes_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
      console.log('✅ QR code PDF sent successfully');
    } catch (error) {
      console.error('❌ QR PDF export error:', error);
      res.status(500).json({ error: 'Failed to generate QR code PDF' });
    }
  }

  @Get('export/qr-pdf/:blockName')
  @ApiOperation({ summary: 'Export block registrations as QR code labels PDF (10mm x 10mm)' })
  @ApiParam({ name: 'blockName', example: 'Bhubaneswar' })
  @ApiResponse({ status: 200, description: 'PDF with QR code labels generated successfully' })
  async exportBlockQRCodePDF(
    @Param('blockName') blockName: string,
    @Res() res: Response,
  ) {
    try {
      const registrations = await this.registrationsService.findByBlockForExport(blockName);

      console.log(`📄 Generating QR code PDF for ${blockName} block (${registrations.length} registrations)...`);

      const pdfBuffer = await this.qrCodePDFService.generateQRCodePDFForBlock(registrations, blockName);

      const filename = `${blockName}_QR_Codes_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
      console.log('✅ Block QR code PDF sent successfully');
    } catch (error) {
      console.error('❌ Block QR PDF export error:', error);
      res.status(500).json({ error: 'Failed to generate QR code PDF' });
    }
  }

  @Post('fast-checkin/:qrCode')
@HttpCode(HttpStatus.OK)
@ApiOperation({ 
  summary: '⚡ Fast check-in for QR scanning (< 5ms response)',
  description: 'Optimized endpoint for high-volume event scanning.',
})
@ApiResponse({ status: 200, description: 'Check-in processed' })
async fastCheckIn(
  @Param('qrCode') qrCode: string,
  @Body() body: CheckInDto,
) {
  // ✅ FIX: Cast body.type to proper union type
  return this.registrationsService.fastCheckIn(
    qrCode,
    body.type as 'entry' | 'lunch' | 'dinner' | 'session', // Add type assertion here
    body.scannedBy,
    body.wasBehalf,
  );
}

  @Post('bulk')
  @ApiOperation({ 
    summary: 'Bulk registration upload',
    description: 'Upload multiple registrations at once.',
  })
  @ApiResponse({ status: 201, description: 'Bulk upload completed' })
  async bulkCreate(@Body() dto: { registrations: CreateRegistrationDto[] }) {
    return this.registrationsService.createBulk(dto.registrations);
  }

  @Post('admin/preload-cache')
  @ApiOperation({ 
    summary: '🔄 Pre-load all registrations into cache',
    description: 'Call this 1 hour before event.',
  })
  @ApiResponse({ status: 200, description: 'Cache pre-loaded' })
  async preloadCache() {
    await this.registrationsService.preloadCache();
    return {
      message: 'Cache pre-load started. This may take 2-3 minutes for 20k registrations.',
      timestamp: new Date(),
    };
  }

  @Get('admin/health')
  @ApiOperation({ summary: '💚 System health check' })
  @ApiResponse({ status: 200 })
  async healthCheck() {
    const health = await this.registrationsService.healthCheck();
    return {
      ...health,
      timestamp: new Date(),
    };
  }
}