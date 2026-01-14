import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAnalytics } from './analytics.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(FileAnalytics)
    private readonly analyticsRepository: Repository<FileAnalytics>,
  ) {}

  async trackUpload(filename: string, originalName: string, mimetype: string, size: number) {
    const record = this.analyticsRepository.create({
      filename,
      originalName,
      mimetype,
      size,
    });
    await this.analyticsRepository.save(record);
    this.logger.log(`Tracked upload: ${filename}`);
  }

  async trackDownload(filename: string, bytesTransferred: number) {
    const record = await this.analyticsRepository.findOne({ where: { filename } });
    if (record) {
      record.downloadCount += 1;
      record.bandwidthUsage = Number(record.bandwidthUsage) + Number(bytesTransferred);
      record.lastAccessTime = new Date();
      await this.analyticsRepository.save(record);
      this.logger.log(`Tracked download: ${filename}`);
    } else {
        this.logger.warn(`Analytics record not found for: ${filename}`);
    }
  }
}
