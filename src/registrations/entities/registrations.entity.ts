import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CheckIn } from './checkin.entity';

@Entity('event_registrations')
@Index(['qrCode'], { unique: true })
@Index(['mobile'], { unique: true })
@Index(['aadhaarOrId'], { unique: true })
@Index(['block'])
@Index(['district'])
@Index(['createdAt'])
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  @Index('idx_qr_scan')
  qrCode: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  village: string;

  @Column({ length: 100 })
  gp: string;

  @Column({ length: 50 })
  district: string;

  @Column({ length: 50 })
  block: string;

  @Column({ length: 10, unique: true })
  mobile: string;

  @Column({ length: 12, unique: true })
  aadhaarOrId: string;

  @Column({ nullable: true, length: 255 })
  photoUrl?: string;

  @Column({ length: 100 })
  category: string;

  @Column({ nullable: true, length: 100 })
  delegateName?: string;

  @Column({ nullable: true, length: 10 })
  delegateMobile?: string;

  @Column({ nullable: true, length: 255 })
  delegatePhotoUrl?: string;

  @Column({ default: false })
  @Index()
  isDelegateAttending: boolean;

  @OneToMany(() => CheckIn, (checkIn) => checkIn.registration, {
    cascade: true,
  })
  checkIns: CheckIn[];

  @CreateDateColumn()
  createdAt: Date;

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