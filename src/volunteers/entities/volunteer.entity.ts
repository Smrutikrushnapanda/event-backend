import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('volunteers')
export class Volunteer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true, length: 10 })
  mobile: string;

  @Column({ unique: true })
  email: string;

  @Column()
  age: number;

  @Column()
  gender: string;

  @Column()
  district: string;

  @Column()
  block: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  photoUrl?: string;

  @Column()
  department: string;

  @Column()
  experience: string;

  @Column()
  password: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  assignedRole?: string;

  @Column({ nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  approvedBy?: string;

  @CreateDateColumn()
  createdAt: Date;
}