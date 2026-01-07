import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CheckIn } from './checkin.entity';

@Entity('event_registrations')
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  qrCode: string;

  @Column()
  name: string;

  @Column()
  village: string;

  @Column()
  gp: string;

  @Column()
  district: string;

  @Column()
  block: string;

  @Column({ length: 10, unique: true })
  mobile: string;

  @Column({ unique: true })
  aadhaarOrId: string;

  @Column({ nullable: true })
  photoUrl?: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  delegateName?: string;

  @Column({ nullable: true })
  delegateMobile?: string;

  @Column({ nullable: true })
  delegatePhotoUrl?: string;

  @Column({ default: false })
  isDelegateAttending: boolean;

  @OneToMany(() => CheckIn, (checkIn) => checkIn.registration, {
    cascade: true,
  })
  checkIns: CheckIn[];

  @CreateDateColumn()
  createdAt: Date;
}