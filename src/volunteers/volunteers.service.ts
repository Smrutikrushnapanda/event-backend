import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Volunteer } from './entities/volunteer.entity';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer)
    private volunteerRepo: Repository<Volunteer>,
    // ✅ Removed SmsService
  ) {}

  async create(data: CreateVolunteerDto & { photoUrl?: string }) {
    const existingMobile = await this.volunteerRepo.findOne({
      where: { mobile: data.mobile },
    });

    if (existingMobile) {
      throw new ConflictException('This mobile number is already registered');
    }

    const existingEmail = await this.volunteerRepo.findOne({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new ConflictException('This email is already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const volunteer = this.volunteerRepo.create({
      ...data,
      password: hashedPassword,
    });

    const saved = await this.volunteerRepo.save(volunteer);

    // ✅ No SMS sent

    const { password, ...result } = saved;
    return result;
  }

  findAll() {
    return this.volunteerRepo.find({ 
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'mobile', 'email', 'age', 'gender', 'district', 'block', 'address', 'photoUrl', 'department', 'experience', 'status', 'assignedRole', 'approvedAt', 'approvedBy', 'createdAt'],
    });
  }

  async findById(id: string) {
    const volunteer = await this.volunteerRepo.findOne({
      where: { id },
    });

    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }

    return volunteer;
  }

  async findByIdPublic(id: string) {
    const volunteer = await this.volunteerRepo.findOne({
      where: { id },
      select: ['id', 'name', 'mobile', 'email', 'age', 'gender', 'district', 'block', 'address', 'photoUrl', 'department', 'experience', 'status', 'assignedRole', 'approvedAt', 'approvedBy', 'createdAt'],
    });

    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }

    return volunteer;
  }

  // ✅ Approve without SMS
  async approveVolunteer(id: string, approvedBy: string, assignedRole?: string) {
    const volunteer = await this.volunteerRepo.findOne({ where: { id } });

    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }

    if (volunteer.status === 'approved') {
      throw new BadRequestException('Volunteer is already approved');
    }

    volunteer.status = 'approved';
    volunteer.approvedAt = new Date();
    volunteer.approvedBy = approvedBy;
    
    if (assignedRole) {
      volunteer.assignedRole = assignedRole;
    }

    await this.volunteerRepo.save(volunteer);

    // ✅ No SMS sent - Admin will inform volunteer directly

    const { password, ...result } = volunteer;
    return result;
  }

  // ✅ Reject without SMS
  async rejectVolunteer(id: string, rejectedBy: string, reason?: string) {
    const volunteer = await this.volunteerRepo.findOne({ where: { id } });

    if (!volunteer) {
      throw new NotFoundException('Volunteer not found');
    }

    if (volunteer.status === 'rejected') {
      throw new BadRequestException('Volunteer is already rejected');
    }

    volunteer.status = 'rejected';
    await this.volunteerRepo.save(volunteer);

    // ✅ No SMS sent

    const { password, ...result } = volunteer;
    return result;
  }

  async validateVolunteer(mobile: string, password: string): Promise<any> {
    const volunteer = await this.volunteerRepo.findOne({
      where: { mobile },
    });

    if (!volunteer) {
      return null;
    }

    if (volunteer.status !== 'approved') {
      throw new BadRequestException('Your account is pending approval. Please wait for admin approval.');
    }

    const isPasswordValid = await bcrypt.compare(password, volunteer.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = volunteer;
    return result;
  }

  async getByStatus(status: string) {
    return this.volunteerRepo.find({
      where: { status },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'mobile', 'email', 'age', 'gender', 'district', 'block', 'address', 'photoUrl', 'department', 'experience', 'status', 'assignedRole', 'approvedAt', 'approvedBy', 'createdAt'],
    });
  }
}