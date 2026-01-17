import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index 
} from 'typeorm';
import { Registration } from './registrations.entity';

@Entity('check_ins')
@Index(['registrationId', 'type', 'checkInDate']) // Composite index for fast lookups
@Index(['checkInDate']) // Date-only index for daily queries
@Index(['registrationId']) // FK index
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ 
    type: 'varchar',
    length: 20,
  })
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ type: 'uuid' })
  registrationId: string;

  @Column({ nullable: true, length: 100 })
  scannedBy?: string;


 @Column({ type: 'date', nullable: false })
checkInDate: Date;

  // ✅ Behalf tracking
  @Column({ type: 'boolean', default: false })
  wasBehalf: boolean;

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

  // ✅ Relation to farmer
  @ManyToOne(() => Registration, (registration) => registration.checkIns, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;
}