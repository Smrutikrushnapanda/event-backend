import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { GuestPass } from './guest-pass.entity';

@Entity('guest_check_ins')
@Index(['guestPassId', 'type', 'checkInDate'])
@Index(['checkInDate'])
export class GuestCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ nullable: true, length: 50 })
  scannedBy: string;

  // ✅ NEW: Which day is this check-in for?
  @Column({ type: 'date' })
  @Index()
  checkInDate: Date;

  // ✅ NEW: Edit tracking
  @Column({ type: 'boolean', default: false })
  wasEdited: boolean;

  @Column({ type: 'varchar', nullable: true })
  originalType?: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ nullable: true })
  editedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  @CreateDateColumn()
  scannedAt: Date;

  @ManyToOne(() => GuestPass, (guestPass) => guestPass.checkIns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guestPassId' })
  guestPass: GuestPass;

  @Column()
  guestPassId: string;
}