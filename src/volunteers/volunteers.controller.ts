import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VolunteersService } from './volunteers.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { ApproveVolunteerDto, RejectVolunteerDto } from './dto/approve-volunteer.dto';
import { LoginVolunteerDto } from './dto/login-volunteer.dto';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(
    private readonly volunteersService: VolunteersService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register as a volunteer with password' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Volunteer registered successfully' })
  @ApiResponse({ status: 409, description: 'Mobile or email already registered' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `volunteer-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  create(
    @Body() dto: CreateVolunteerDto,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    const photoUrl = photo ? `/uploads/${photo.filename}` : undefined;
    return this.volunteersService.create({ ...dto, photoUrl });
  }

  // ✅ Login endpoint with JWT token
  @Post('login')
  @ApiOperation({ summary: 'Volunteer login - Returns JWT token' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful - Returns access token and user data',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        volunteer: {
          id: 'uuid',
          name: 'John Doe',
          mobile: '9876543210',
          email: 'john@example.com',
          status: 'approved',
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials or account not approved' })
  async login(@Body() dto: LoginVolunteerDto) {
    const volunteer = await this.volunteersService.validateVolunteer(dto.mobile, dto.password);

    if (!volunteer) {
      throw new BadRequestException('Invalid mobile number or password');
    }

    // ✅ Generate JWT token
    const accessToken = this.authService.generateToken(volunteer);

    return {
      accessToken,
      volunteer,
    };
  }

  // ✅ Protected route - Get current volunteer profile
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in volunteer profile' })
  @ApiResponse({ status: 200, description: 'Returns current volunteer data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getMe(@GetUser() volunteer: any) {
    const { password, ...result } = volunteer;
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get all volunteers' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Returns all volunteers' })
  getAll(@Query('status') status?: string) {
    if (status) {
      return this.volunteersService.getByStatus(status);
    }
    return this.volunteersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get volunteer by ID' })
  @ApiParam({ name: 'id', description: 'Volunteer UUID' })
  @ApiResponse({ status: 200, description: 'Returns volunteer details' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  getById(@Param('id') id: string) {
    return this.volunteersService.findByIdPublic(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve volunteer and send SMS notification' })
  @ApiParam({ name: 'id', description: 'Volunteer UUID' })
  @ApiResponse({ status: 200, description: 'Volunteer approved successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  approveVolunteer(
    @Param('id') id: string,
    @Body() dto: ApproveVolunteerDto,
  ) {
    return this.volunteersService.approveVolunteer(id, dto.approvedBy, dto.assignedRole);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject volunteer application' })
  @ApiParam({ name: 'id', description: 'Volunteer UUID' })
  @ApiResponse({ status: 200, description: 'Volunteer rejected' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  rejectVolunteer(
    @Param('id') id: string,
    @Body() dto: RejectVolunteerDto,
  ) {
    return this.volunteersService.rejectVolunteer(id, dto.rejectedBy, dto.reason);
  }
}