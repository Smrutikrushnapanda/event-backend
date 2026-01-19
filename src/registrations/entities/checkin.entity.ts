import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index 
} from 'typeorm';
import { Registration } from './registrations.entity';

@Entity('check_ins')
@Index(['registrationId', 'type', 'checkInDate'])
@Index(['checkInDate'])
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ type: 'uuid' })
  @Index()
  registrationId: string;

  @Column({ nullable: true })
  scannedBy?: string;

  // ✅ NEW: Which day is this check-in for?
  @Column({ type: 'date' })
  @Index()
  checkInDate: Date;

  @Column({ type: 'boolean', default: false })
  wasBehalf: boolean;

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

  @ManyToOne(() => Registration, (registration) => registration.checkIns, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;
}