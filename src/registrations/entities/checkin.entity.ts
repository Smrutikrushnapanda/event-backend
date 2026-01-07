import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Registration } from './registrations.entity';

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: string;

  @ManyToOne(() => Registration, (registration) => registration.checkIns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;

  @Column({ default: false })
  wasDelegate: boolean;

  @CreateDateColumn()
  scannedAt: Date;
}