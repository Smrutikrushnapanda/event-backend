import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Registration } from './registrations.entity';

@Entity('check_ins')
@Index(['registrationId', 'type'], { unique: true })
@Index(['type'])
@Index(['scannedAt'])
@Index(['registrationId'])
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: 'entry' | 'lunch' | 'dinner' | 'session';

  @Column({ nullable: true, length: 50 })
  scannedBy: string;

  @Column({ default: false })
  wasDelegate: boolean;

  @CreateDateColumn()
  scannedAt: Date;

  @ManyToOne(() => Registration, (registration) => registration.checkIns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;

  @Column()
  registrationId: string;
}