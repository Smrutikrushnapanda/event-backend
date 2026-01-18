import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PassCategory } from '../enums/pass-category.enum';
import { GuestCheckIn } from './guest-checkin.entity';

@Entity('guest_passes')
@Index(['qrCode'], { unique: true })
@Index(['category'])
@Index(['createdAt'])
export class GuestPass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  @Index('idx_guest_qr_scan')
  qrCode: string;

  @Column({
    type: 'enum',
    enum: PassCategory,
  })
  category: PassCategory;

  @Column({ type: 'int' })
  sequenceNumber: number;

  @Column({ default: false })
  @Index()
  isAssigned: boolean;

  @Column({ nullable: true, length: 100 })
  name?: string;

  @Column({ nullable: true, length: 10 })
  mobile?: string;

  // ✅ NEW: Designation field
  @Column({ nullable: true, length: 500 })
  designation?: string;

  @Column({ nullable: true, length: 500 })
  assignedBy?: string;

  @Column({ nullable: true })
  assignedAt?: Date;

  @OneToMany(() => GuestCheckIn, (checkIn) => checkIn.guestPass, {
    cascade: true,
  })
  checkIns: GuestCheckIn[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  @Index()
  hasEntryCheckIn: boolean;

  @Column({ default: false })
  hasLunchCheckIn: boolean;

  @Column({ default: false })
  hasDinnerCheckIn: boolean;

  @Column({ default: false })
  hasSessionCheckIn: boolean;
}