import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class FileAnalytics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimetype: string;

  @Column('bigint') // File sizes can be large
  size: number;

  @CreateDateColumn()
  uploadTime: Date;

  @Column({ default: 0 })
  downloadCount: number;

  @Column({ nullable: true })
  lastAccessTime: Date;

  @Column('bigint', { default: 0 })
  bandwidthUsage: number; // Total bytes transferred (downloads)
}
