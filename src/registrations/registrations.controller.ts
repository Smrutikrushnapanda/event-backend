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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/checkin.dto';
import { AddDelegateDto } from './dto/add-delegate.dto';

@ApiTags('Registrations')
@Controller('registrations')
export class RegistrationsController {

  constructor(private readonly registrationsService: RegistrationsService) {}

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
        fileSize: 50 * 1024 * 1024, // 50MB
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

  // ✅ NEW ENDPOINT: CHECK IF AADHAAR EXISTS
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
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        qrCode: { type: 'string' },
        name: { type: 'string' },
      },
    },
  })
  checkAadhaar(@Body('aadhaarOrId') aadhaarOrId: string) {
    return this.registrationsService.checkAadhaar(aadhaarOrId);
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'Get registration by QR code' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0', description: 'Unique QR code' })
  @ApiResponse({ status: 200, description: 'Returns registration details' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  getByQr(@Param('qrCode') qrCode: string) {
    return this.registrationsService.findByQrCode(qrCode);
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
  @ApiOperation({ summary: 'Check-in using QR code' })
  @ApiParam({ name: 'qrCode', example: 'EVENT-ABC123XYZ0', description: 'Unique QR code' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Already checked in today' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  checkIn(
    @Param('qrCode') qrCode: string,
    @Body() dto: CheckInDto,
  ) {
    return this.registrationsService.checkIn(qrCode, dto);
  }

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
        fileSize: 50 * 1024 * 1024, // 50MB
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