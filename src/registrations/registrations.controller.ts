import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Patch, 
  Query,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes, 
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/checkin.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';
import { CheckIn } from './entities/checkin.entity';
import { ExcelExportService } from './excel-export.service';

@ApiTags('Registrations')
@Controller('registrations')
export class RegistrationsController {

  constructor(
    private readonly registrationsService: RegistrationsService,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
    private readonly excelExportService: ExcelExportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new registration with optional photo upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        village: { type: 'string', example: 'Bhubaneswar' },
        gp: { type: 'string', example: 'Bhubaneswar GP' },
        district: { type: 'string', example: 'Khordha' },
        block: { type: 'string', example: 'Bhubaneswar' },
        mobile: { type: 'string', example: '9876543210' },
        aadhaarOrId: { type: 'string', example: '123456789012' },
        category: { type: 'string', example: 'General' },
        photo: { type: 'string', format: 'binary', description: 'Optional photo (max 50MB)' },
      },
      required: ['name', 'village', 'gp', 'district', 'block', 'mobile', 'aadhaarOrId', 'category'],
    },
  })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - mobile/aadhaar already registered' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  create(
    @Body() dto: CreateRegistrationDto,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    console.log('Received DTO:', dto);
    console.log('Has photo:', !!photo);
    
    const photoUrl = photo ? `/uploads/${photo.filename}` : undefined;
    return this.registrationsService.create({ ...dto, photoUrl });
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
  @ApiOperation({ summary: 'Export all registrations to CSV (fast, no images)' })
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
  @ApiResponse({ 
    status: 200, 
    description: 'Returns registration details with check-in history',
  })
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

      // ✅ Only 4 types: entry, lunch, dinner, session
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
        gp: registration.gp,
        district: registration.district,
        block: registration.block,
        mobile: registration.mobile,
        aadhaarOrId: registration.aadhaarOrId,
        photoUrl: registration.photoUrl,
        category: registration.category,
        delegateName: registration.delegateName,
        delegateMobile: registration.delegateMobile,
        delegatePhotoUrl: registration.delegatePhotoUrl,
        isDelegateAttending: registration.isDelegateAttending,
        createdAt: registration.createdAt,
        hasCheckedIn,
        checkIns: checkIns.map(c => ({
          id: c.id,
          type: c.type,
          scannedAt: c.scannedAt,
          wasDelegate: c.wasDelegate,
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['entry', 'lunch', 'dinner', 'session'],
          example: 'entry',
          description: 'Activity type: entry, lunch, dinner, or session'
        },
        scannedBy: { type: 'string', example: 'Volunteer', description: 'Optional: who scanned' },
      },
      required: ['type'],
    },
  })
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
      wasDelegate: body.wasDelegate || false,
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

  // ✅ REMOVED: Kit distribution endpoint

  @Post(':id/delegate')
  @ApiOperation({ summary: 'Add delegate/relative to registration' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        delegateName: { type: 'string', example: 'Jane Doe' },
        delegateMobile: { type: 'string', example: '9876543210' },
        delegatePhoto: { type: 'string', format: 'binary', description: 'Optional delegate photo' },
      },
      required: ['delegateName', 'delegateMobile'],
    },
  })
  @ApiResponse({ status: 200, description: 'Delegate added successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @UseInterceptors(
    FileInterceptor('delegatePhoto', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `delegate-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  addDelegate(
    @Param('id') id: string,
    @Body() dto: AddDelegateDto,
    @UploadedFile() delegatePhoto: Express.Multer.File,
  ) {
    const delegatePhotoUrl = delegatePhoto ? `/uploads/${delegatePhoto.filename}` : undefined;
    return this.registrationsService.addDelegate(id, { ...dto, delegatePhotoUrl });
  }

  @Patch(':id/delegate/toggle')
  @ApiOperation({ summary: 'Toggle between original user and delegate attendance' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiQuery({ 
    name: 'isDelegateAttending', 
    type: 'boolean', 
    example: true,
    description: 'True if delegate is attending, false for original user' 
  })
  @ApiResponse({ status: 200, description: 'Attendance toggled successfully' })
  @ApiResponse({ status: 400, description: 'No delegate registered' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  toggleDelegate(
    @Param('id') id: string,
    @Query('isDelegateAttending') isDelegateAttending: string,
  ) {
    return this.registrationsService.toggleDelegate(id, isDelegateAttending === 'true');
  }

  @Get(':id/checkins')
  @ApiOperation({ summary: 'Get all check-ins for a registration' })
  @ApiParam({ name: 'id', description: 'Registration UUID' })
  @ApiResponse({ status: 200, description: 'Returns check-in history with summary' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  getCheckIns(@Param('id') id: string) {
    return this.registrationsService.getCheckIns(id);
  }
}