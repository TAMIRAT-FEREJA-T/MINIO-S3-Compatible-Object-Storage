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
  ) { }

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

  async getOverview() {
    const totalFiles = await this.analyticsRepository.count();
    const { totalSize } = await this.analyticsRepository
      .createQueryBuilder('file_analytics')
      .select('SUM(file_analytics.size)', 'totalSize')
      .getRawOne();

    const { totalBandwidth } = await this.analyticsRepository
      .createQueryBuilder('file_analytics')
      .select('SUM(file_analytics.bandwidthUsage)', 'totalBandwidth')
      .getRawOne();

    return {
      totalFiles,
      totalSize: Number(totalSize) || 0,
      totalBandwidth: Number(totalBandwidth) || 0,
    };
  }

  async getTopDownloads(limit: number = 5) {
    return this.analyticsRepository.find({
      order: { downloadCount: 'DESC' },
      take: limit,
    });
  }

  async getStorageByMimeType() {
    // Returns array of { mimetype: 'image/png', totalSize: '123456' }
    return this.analyticsRepository
      .createQueryBuilder('file_analytics')
      .select('file_analytics.mimetype', 'mimetype')
      .addSelect('SUM(file_analytics.size)', 'totalSize')
      .groupBy('file_analytics.mimetype')
      .getRawMany();
  }
}
