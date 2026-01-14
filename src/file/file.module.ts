import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { MinioModule } from '../minio/minio.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [MinioModule, AnalyticsModule],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
