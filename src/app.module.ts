import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MinioModule } from './minio/minio.module';
import { FileModule } from './file/file.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FileAnalytics } from './analytics/analytics.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'analytics.db',
      entities: [FileAnalytics],
      synchronize: true,
    }),
    MinioModule,
    AnalyticsModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
