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
@Index(['guestPassId', 'type', 'checkInDate']) // Composite index for fast lookups
@Index(['checkInDate']) // Date-only index for daily queries
@Index(['guestPassId']) // FK index
export class GuestCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ nullable: true, length: 100 })
  scannedBy: string;

  // ✅ CRITICAL: Which day is this check-in for?
  // Stored as DATE type (YYYY-MM-DD) in PostgreSQL
  // This allows daily repeats - one check-in of each type per day
  @Column({ type: 'date' })
  @Index()
  checkInDate: Date;

  // ✅ Edit tracking
  @Column({ type: 'boolean', default: false })
  wasEdited: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  originalType?: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ nullable: true, length: 100 })
  editedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  // ✅ When was this check-in actually scanned?
  // Stored as TIMESTAMP for precise timing
  @CreateDateColumn({ type: 'timestamp' })
  scannedAt: Date;

  // ✅ Relation to guest pass
  @ManyToOne(() => GuestPass, (guestPass) => guestPass.checkIns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guestPassId' })
  guestPass: GuestPass;

  @Column({ type: 'uuid' })
  guestPassId: string;
}