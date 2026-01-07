import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Registration } from './registrations.entity';

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: 'entry' | 'lunch' | 'dinner' | 'session'; // ✅ No 'kit'

  @Column({ nullable: true })
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