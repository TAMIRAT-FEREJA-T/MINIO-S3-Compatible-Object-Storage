import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { FileAnalytics } from './analytics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileAnalytics])],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
