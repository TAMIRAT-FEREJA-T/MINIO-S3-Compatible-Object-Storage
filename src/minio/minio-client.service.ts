import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioClientService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucketName: string;
  private readonly logger = new Logger(MinioClientService.name);

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get('MINIO_BUCKET_NAME', 'my-files');

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000')),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit() {
    this.logger.log('Initializing MinIO Client...');
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        this.logger.log(`Bucket ${this.bucketName} not found. Creating...`);
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1'); // Region is required but often ignored by standalone MinIO
        this.logger.log(`Bucket ${this.bucketName} created successfully.`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists.`);
      }
    } catch (err) {
      this.logger.error('Error initializing MinIO:', err);
      // Depending on severity, we might want to throw error here to stop app startup
    }
  }

  get client() {
    return this.minioClient;
  }

  get bucket() {
    return this.bucketName;
  }
}
