import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Registration } from './registrations.entity';

export enum CheckInType {
  ENTRY = 'entry',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  EXIT = 'exit',
}

@Entity('check_ins')
export class CheckIn {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: CheckInType,
  })
  type: CheckInType;

  @Column({ nullable: true })
  scannedBy?: string;

  @Column({ default: false })
  wasDelegate: boolean;

  @CreateDateColumn()
  scannedAt: Date;

  @ManyToOne(() => Registration, (reg) => reg.checkIns)
  @JoinColumn({ name: 'registrationId' })
  registration: Registration;

  @Column()
  registrationId: string;
}