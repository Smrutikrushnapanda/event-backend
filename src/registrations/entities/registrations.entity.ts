import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  OneToMany,
  Index 
} from 'typeorm';
import { CheckIn } from './checkin.entity';

@Entity('event_registrations')
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  qrCode: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  village: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  block: string;

  @Column({ unique: true, length: 15 })
  mobile: string;

  @Column({ unique: true })
  aadhaarOrId: string;

  @Column({ type: 'varchar', length: 10 })
  gender: 'male' | 'female' | 'others';

  @Column({ type: 'varchar', length: 10 })
  caste: 'general' | 'obc' | 'sc' | 'st';

  @Column()
  category: string;

  // ✅ BEHALF FIELDS (Attending on behalf of registered farmer)
  @Column({ nullable: true, length: 100 })
  behalfName?: string;

  @Column({ nullable: true, length: 15 })
  behalfMobile?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  behalfGender?: 'male' | 'female' | 'others';

  @Column({ type: 'boolean', default: false })
  isBehalfAttending: boolean;

  // Check-in status flags
  @Column({ default: false })
  hasEntryCheckIn: boolean;

  @Column({ default: false })
  hasLunchCheckIn: boolean;

  @Column({ default: false })
  hasDinnerCheckIn: boolean;

  @Column({ default: false })
  hasSessionCheckIn: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => CheckIn, (checkIn) => checkIn.registration)
  checkIns: CheckIn[];
}