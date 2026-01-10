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
@Index(['guestPassId', 'type'], { unique: true })
@Index(['type'])
@Index(['scannedAt'])
@Index(['guestPassId'])
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