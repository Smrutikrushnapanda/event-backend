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

interface CheckInDto {
  type: 'entry' | 'lunch' | 'dinner' | 'session';
  scannedBy: string;
  wasBehalf?: boolean;
}

@ApiTags('Universal Check-in')
@Controller('universal-checkin')
export class UniversalCheckinController {
  private readonly logger = new Logger(UniversalCheckinController.name);

  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly guestPassesService: GuestPassesService,
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
          attendee: {
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
            behalfName: farmer.behalfName,
            behalfMobile: farmer.behalfMobile,
            behalfGender: farmer.behalfGender,
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
        attendee: {
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

  // ✅ CHECK-IN - Creates check-in record
  @Post(':qrCode')
  @ApiOperation({ 
    summary: 'Universal check-in',
    description: 'Creates a check-in record for farmer or guest. Tries farmer first, then guest.'
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
            attendee: {
              id: farmer.id,
              name: farmer.name,
              mobile: farmer.mobile,
              village: farmer.village,
              block: farmer.block,
              district: farmer.district,
              category: farmer.category,
              qrCode: farmer.qrCode,
              behalfName: farmer.behalfName,
              behalfMobile: farmer.behalfMobile,
              behalfGender: farmer.behalfGender,
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

        // ✅ Use fastCheckIn with ACTUAL parameter name: wasDelegate
        const result = await this.registrationsService.fastCheckIn(
          qrCode,
          checkInDto.type,
          checkInDto.scannedBy,
          checkInDto.wasBehalf || false, // Pass as wasDelegate parameter
        );

        if (!result.success) {
          return {
            success: false,
            message: result.message,
            type: 'farmer',
            attendeeType: 'FARMER',
          };
        }

        // Get updated farmer data
        const updatedFarmer = await this.registrationsService.findByQrCode(qrCode);

        if (!updatedFarmer) {
          throw new NotFoundException('Farmer not found after check-in');
        }

        return {
          success: true,
          message: `${checkInDto.type.toUpperCase()} check-in successful`,
          type: 'farmer',
          attendeeType: 'FARMER',
          attendee: {
            id: updatedFarmer.id,
            name: updatedFarmer.name,
            mobile: updatedFarmer.mobile,
            village: updatedFarmer.village,
            block: updatedFarmer.block,
            district: updatedFarmer.district,
            category: updatedFarmer.category,
            qrCode: updatedFarmer.qrCode,
            behalfName: updatedFarmer.behalfName,
            behalfMobile: updatedFarmer.behalfMobile,
            behalfGender: updatedFarmer.behalfGender,
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
      this.logger.warn(`❌ Farmer not found: ${qrCode}`);
      // Continue to try guest
    }

    try {
      // Try guest
      const guest = await this.guestPassesService.getByQrCode(qrCode);
      
      this.logger.log(`✅ Checking in Guest: ${guest.name || 'Unassigned'}`);
      
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
          attendee: {
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

      // Use fastCheckIn for guest
      const result = await this.guestPassesService.fastCheckIn(
        qrCode,
        checkInDto.type,
        checkInDto.scannedBy,
      );

      if (!result.success) {
        return {
          success: false,
          message: result.message,
          type: 'guest',
          attendeeType: 'GUEST',
        };
      }

      // Get updated guest data
      const updatedGuest = await this.guestPassesService.getByQrCode(qrCode);

      return {
        success: true,
        message: `${checkInDto.type.toUpperCase()} check-in successful`,
        type: 'guest',
        attendeeType: 'GUEST',
        attendee: {
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
      this.logger.warn(`❌ Guest not found: ${qrCode}`);
    }

    // Neither found
    throw new NotFoundException('QR code not found in system');
  }
}