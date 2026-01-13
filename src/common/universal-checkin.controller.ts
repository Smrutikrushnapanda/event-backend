import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { RegistrationsService } from '../registrations/registrations.service';
import { GuestPassesService } from '../guest-passes/guest-passes.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/entities/registrations.entity';
import { CheckIn } from '../registrations/entities/checkin.entity';
import { GuestPass } from '../guest-passes/entities/guest-pass.entity';
import { GuestCheckIn } from '../guest-passes/entities/guest-checkin.entity';

interface CheckInDto {
  type: 'entry' | 'lunch' | 'dinner' | 'session';
  scannedBy: string;
  wasBehalf?: boolean;
  behalfName?: string;
  behalfMobile?: string;
  behalfGender?: 'male' | 'female' | 'others';
}

@ApiTags('Universal Check-in')
@Controller('universal-checkin')
export class UniversalCheckinController {
  private readonly logger = new Logger(UniversalCheckinController.name);

  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly guestPassesService: GuestPassesService,
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    @InjectRepository(CheckIn)
    private checkInRepository: Repository<CheckIn>,
    @InjectRepository(GuestPass)
    private guestPassRepository: Repository<GuestPass>,
    @InjectRepository(GuestCheckIn)
    private guestCheckInRepository: Repository<GuestCheckIn>,
  ) {}

  // ✅ LOOKUP ONLY - Does NOT create check-in record
  @Post(':qrCode/lookup')
  @ApiOperation({ 
    summary: 'Lookup attendee by QR code (NO check-in)',
    description: 'Retrieves attendee information without creating a check-in record. Tries farmer first, then guest.'
  })
  @ApiParam({ name: 'qrCode', description: 'QR code to lookup' })
  async universalLookup(@Param('qrCode') qrCode: string) {
    this.logger.log(`🔍 Universal Lookup: ${qrCode}`);

    try {
      // Try farmer first - uses findByQrCode (returns null if not found)
      const farmer = await this.registrationsService.findByQrCode(qrCode);
      
      if (farmer) {
        this.logger.log(`✅ Found Farmer: ${farmer.name}`);
        
        return {
          success: true,
          message: 'Farmer found',
          type: 'farmer',
          attendeeType: 'FARMER',
          data: {
            id: farmer.id,
            name: farmer.name,
            mobile: farmer.mobile,
            village: farmer.village,
            block: farmer.block,
            district: farmer.district,
            category: farmer.category,
            gender: farmer.gender,
            caste: farmer.caste,
            qrCode: farmer.qrCode,
            behalfName: farmer.behalfName || null,
            behalfMobile: farmer.behalfMobile || null,
            behalfGender: farmer.behalfGender || null,
            isBehalfAttending: farmer.isBehalfAttending || false,
            hasCheckedIn: {
              entry: farmer.hasEntryCheckIn || false,
              lunch: farmer.hasLunchCheckIn || false,
              dinner: farmer.hasDinnerCheckIn || false,
              session: farmer.hasSessionCheckIn || false,
            },
          },
        };
      }
    } catch (farmerError) {
      this.logger.warn(`❌ Farmer not found: ${qrCode}`);
      // Continue to try guest
    }

    try {
      // Try guest - uses getByQrCode (throws NotFoundException if not found)
      const guest = await this.guestPassesService.getByQrCode(qrCode);
      
      this.logger.log(`✅ Found Guest: ${guest.name || 'Unassigned'}`);
      
      return {
        success: true,
        message: guest.isAssigned ? 'Guest found' : 'Unassigned guest pass',
        type: 'guest',
        attendeeType: 'GUEST',
        data: {
          id: guest.id,
          name: guest.name,
          mobile: guest.mobile,
          category: guest.category,
          qrCode: guest.qrCode,
          isAssigned: guest.isAssigned,
          sequenceNumber: guest.sequenceNumber,
          hasCheckedIn: {
            entry: guest.hasEntryCheckIn || false,
            lunch: guest.hasLunchCheckIn || false,
            dinner: guest.hasDinnerCheckIn || false,
            session: guest.hasSessionCheckIn || false,
          },
        },
      };
    } catch (guestError) {
      this.logger.warn(`❌ Guest not found: ${qrCode}`);
    }

    // Neither found
    throw new NotFoundException('QR code not found in system');
  }

  // ✅ CHECK-IN - Creates check-in record with behalf support
  @Post(':qrCode')
  @ApiOperation({ 
    summary: 'Universal check-in',
    description: 'Creates a check-in record for farmer or guest. Supports behalf person check-in for farmers.'
  })
  @ApiParam({ name: 'qrCode', description: 'QR code to check in' })
  @ApiBody({
    description: 'Check-in data',
    schema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['entry', 'lunch', 'dinner', 'session'],
          description: 'Type of check-in'
        },
        scannedBy: { 
          type: 'string',
          description: 'ID of volunteer who scanned'
        },
        wasBehalf: {
          type: 'boolean',
          description: 'Whether this check-in is for a behalf person',
          default: false
        },
        behalfName: {
          type: 'string',
          description: 'Name of behalf person (required if wasBehalf is true)',
          required: false
        },
        behalfMobile: {
          type: 'string',
          description: 'Mobile of behalf person (required if wasBehalf is true)',
          required: false
        },
        behalfGender: {
          type: 'string',
          enum: ['male', 'female', 'others'],
          description: 'Gender of behalf person (required if wasBehalf is true)',
          required: false
        }
      },
      required: ['type', 'scannedBy']
    }
  })
  async universalCheckIn(
    @Param('qrCode') qrCode: string,
    @Body() checkInDto: CheckInDto,
  ) {
    this.logger.log(`📝 Universal Check-in: ${qrCode} - ${checkInDto.type}`);

    if (!['entry', 'lunch', 'dinner', 'session'].includes(checkInDto.type)) {
      throw new BadRequestException('Invalid check-in type. Must be: entry, lunch, dinner, or session');
    }

    // ✅ Validate behalf data if wasBehalf is true
    if (checkInDto.wasBehalf) {
      if (!checkInDto.behalfName || !checkInDto.behalfMobile || !checkInDto.behalfGender) {
        throw new BadRequestException(
          'behalfName, behalfMobile, and behalfGender are required when wasBehalf is true'
        );
      }
      
      if (!['male', 'female', 'others'].includes(checkInDto.behalfGender)) {
        throw new BadRequestException('behalfGender must be: male, female, or others');
      }
    }

    try {
      // Try farmer first
      const farmer = await this.registrationsService.findByQrCode(qrCode);
      
      if (farmer) {
        this.logger.log(`✅ Checking in Farmer: ${farmer.name}`);
        
        // Check if already checked in
        const alreadyCheckedIn = 
          (checkInDto.type === 'entry' && farmer.hasEntryCheckIn) ||
          (checkInDto.type === 'lunch' && farmer.hasLunchCheckIn) ||
          (checkInDto.type === 'dinner' && farmer.hasDinnerCheckIn) ||
          (checkInDto.type === 'session' && farmer.hasSessionCheckIn);

        if (alreadyCheckedIn) {
          return {
            success: false,
            message: `Already checked in for ${checkInDto.type}`,
            type: 'farmer',
            attendeeType: 'FARMER',
            alreadyCheckedIn: true,
            data: {
              id: farmer.id,
              name: farmer.name,
              mobile: farmer.mobile,
              village: farmer.village,
              block: farmer.block,
              district: farmer.district,
              category: farmer.category,
              qrCode: farmer.qrCode,
              behalfName: farmer.behalfName || null,
              behalfMobile: farmer.behalfMobile || null,
              behalfGender: farmer.behalfGender || null,
              isBehalfAttending: farmer.isBehalfAttending || false,
              hasCheckedIn: {
                entry: farmer.hasEntryCheckIn || false,
                lunch: farmer.hasLunchCheckIn || false,
                dinner: farmer.hasDinnerCheckIn || false,
                session: farmer.hasSessionCheckIn || false,
              },
            },
          };
        }

        // ✅ If wasBehalf is true, update farmer's behalf information
        if (checkInDto.wasBehalf) {
          farmer.behalfName = checkInDto.behalfName;
          farmer.behalfMobile = checkInDto.behalfMobile;
          farmer.behalfGender = checkInDto.behalfGender;
          farmer.isBehalfAttending = true;
          
          this.logger.log(`✅ Updated behalf person: ${checkInDto.behalfName}`);
        }

        // ✅ Create check-in record
        const checkIn = this.checkInRepository.create({
          type: checkInDto.type,
          registrationId: farmer.id,
          scannedBy: checkInDto.scannedBy,
          wasBehalf: checkInDto.wasBehalf || false,
          scannedAt: new Date(),
        });

        await this.checkInRepository.save(checkIn);
        this.logger.log(`✅ CheckIn record created for farmer ${farmer.id}`);

        // ✅ Update farmer check-in flags
        if (checkInDto.type === 'entry') farmer.hasEntryCheckIn = true;
        if (checkInDto.type === 'lunch') farmer.hasLunchCheckIn = true;
        if (checkInDto.type === 'dinner') farmer.hasDinnerCheckIn = true;
        if (checkInDto.type === 'session') farmer.hasSessionCheckIn = true;

        await this.registrationRepository.save(farmer);
        this.logger.log(`✅ Farmer flags updated`);

        // Get updated farmer data
        const updatedFarmer = await this.registrationsService.findByQrCode(qrCode);

        if (!updatedFarmer) {
          throw new NotFoundException('Farmer not found after check-in');
        }

        return {
          success: true,
          message: `${checkInDto.type.toUpperCase()} check-in successful${checkInDto.wasBehalf ? ' (Behalf person)' : ''}`,
          type: 'farmer',
          attendeeType: 'FARMER',
          data: {
            id: updatedFarmer.id,
            name: updatedFarmer.name,
            mobile: updatedFarmer.mobile,
            village: updatedFarmer.village,
            block: updatedFarmer.block,
            district: updatedFarmer.district,
            category: updatedFarmer.category,
            qrCode: updatedFarmer.qrCode,
            behalfName: updatedFarmer.behalfName || null,
            behalfMobile: updatedFarmer.behalfMobile || null,
            behalfGender: updatedFarmer.behalfGender || null,
            isBehalfAttending: updatedFarmer.isBehalfAttending || false,
            hasCheckedIn: {
              entry: updatedFarmer.hasEntryCheckIn || false,
              lunch: updatedFarmer.hasLunchCheckIn || false,
              dinner: updatedFarmer.hasDinnerCheckIn || false,
              session: updatedFarmer.hasSessionCheckIn || false,
            },
          },
        };
      }
    } catch (farmerError) {
      this.logger.error(`❌ Farmer check-in error:`, farmerError);
      // Continue to try guest
    }

    try {
      // Try guest
      const guest = await this.guestPassesService.getByQrCode(qrCode);
      
      this.logger.log(`✅ Checking in Guest: ${guest.name || 'Unassigned'}`);
      
      // ✅ Guests don't support behalf check-in
      if (checkInDto.wasBehalf) {
        throw new BadRequestException('Behalf check-in is not supported for guests');
      }
      
      // Check if already checked in
      const alreadyCheckedIn = 
        (checkInDto.type === 'entry' && guest.hasEntryCheckIn) ||
        (checkInDto.type === 'lunch' && guest.hasLunchCheckIn) ||
        (checkInDto.type === 'dinner' && guest.hasDinnerCheckIn) ||
        (checkInDto.type === 'session' && guest.hasSessionCheckIn);

      if (alreadyCheckedIn) {
        return {
          success: false,
          message: `Already checked in for ${checkInDto.type}`,
          type: 'guest',
          attendeeType: 'GUEST',
          alreadyCheckedIn: true,
          data: {
            id: guest.id,
            name: guest.name,
            mobile: guest.mobile,
            category: guest.category,
            qrCode: guest.qrCode,
            isAssigned: guest.isAssigned,
            sequenceNumber: guest.sequenceNumber,
            hasCheckedIn: {
              entry: guest.hasEntryCheckIn || false,
              lunch: guest.hasLunchCheckIn || false,
              dinner: guest.hasDinnerCheckIn || false,
              session: guest.hasSessionCheckIn || false,
            },
          },
        };
      }

      // ✅ Create guest check-in record
      const guestCheckIn = this.guestCheckInRepository.create({
        type: checkInDto.type,
        guestPassId: guest.id,
        scannedBy: checkInDto.scannedBy,
        scannedAt: new Date(),
      });

      await this.guestCheckInRepository.save(guestCheckIn);
      this.logger.log(`✅ GuestCheckIn record created for guest ${guest.id}`);

      // ✅ Update guest flags
      if (checkInDto.type === 'entry') guest.hasEntryCheckIn = true;
      if (checkInDto.type === 'lunch') guest.hasLunchCheckIn = true;
      if (checkInDto.type === 'dinner') guest.hasDinnerCheckIn = true;
      if (checkInDto.type === 'session') guest.hasSessionCheckIn = true;

      await this.guestPassRepository.save(guest);
      this.logger.log(`✅ Guest flags updated`);

      // Get updated guest data
      const updatedGuest = await this.guestPassesService.getByQrCode(qrCode);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful`,
        type: 'guest',
        attendeeType: 'GUEST',
        data: {
          id: updatedGuest.id,
          name: updatedGuest.name,
          mobile: updatedGuest.mobile,
          category: updatedGuest.category,
          qrCode: updatedGuest.qrCode,
          isAssigned: updatedGuest.isAssigned,
          sequenceNumber: updatedGuest.sequenceNumber,
          hasCheckedIn: {
            entry: updatedGuest.hasEntryCheckIn || false,
            lunch: updatedGuest.hasLunchCheckIn || false,
            dinner: updatedGuest.hasDinnerCheckIn || false,
            session: updatedGuest.hasSessionCheckIn || false,
          },
        },
      };
    } catch (guestError) {
      this.logger.error(`❌ Guest check-in error:`, guestError);
    }

    // Neither found
    throw new NotFoundException('QR code not found in system');
  }
}