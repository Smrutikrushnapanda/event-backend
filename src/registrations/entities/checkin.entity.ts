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

  // ✅ BEHALF FLAG (Was this check-in done by someone on behalf?)
  @Column({ type: 'boolean', default: false })
  wasBehalf: boolean;

  @CreateDateColumn()
  scannedAt: Date;

  @ManyToOne(() => Registration, (registration) => registration.checkIns)
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;
}