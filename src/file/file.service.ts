import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { MinioClientService } from '../minio/minio-client.service';
import { Stream } from 'stream';
import { AnalyticsService } from '../analytics/analytics.service';
import { BufferedFile } from 'src/minio/file.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
  constructor(
    private readonly minioClientService: MinioClientService,
    private readonly analyticsService: AnalyticsService,
  ) {}
  private readonly logger = new Logger(FileService.name);

  async uploadFile(file: BufferedFile) {
    if (!file) return;

    // 1. Sanitize simple filename
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();

    // 2. Add UUID
    const filename = `${uuidv4()}-${sanitizedOriginalName}`;

    // 3. Generate Date Path (YYYY-MM-DD)
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0]; // "2024-01-14"

    // 4. Determine Category from Mimetype
    const category = this.getCategoryFromMimetype(file.mimetype);

    // 5. Construct Full Object Key (Date -> Category -> File)
    const objectKey = `${dateFolder}/${category}/${filename}`;

    const metaData = {
      'Content-Type': file.mimetype,
      'Original-Name': file.originalname, // Keep strict original in metadata
    };

    try {
      await this.minioClientService.client.putObject(
        this.minioClientService.bucket,
        objectKey,
        file.buffer,
        file.size,
        metaData,
      );

      await this.analyticsService.trackUpload(objectKey, file.originalname, file.mimetype, file.size);

      this.logger.log(`File uploaded successfully: ${objectKey}`);

    } catch (error) {
       throw new InternalServerErrorException(error);
    }

    return {
      filename: objectKey, // Return the full key so we can retrieve it later
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/file/download/${encodeURIComponent(objectKey)}`, // Encode slashes for URL safety if needed, though most browsers handle it
    };
  }

  private getCategoryFromMimetype(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'videos';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('text/') || mimetype === 'application/pdf' || mimetype.includes('word') || mimetype.includes('document')) return 'documents';
    return 'others';
  }

  async deleteFile(filename: string) {
    try {
      await this.minioClientService.client.removeObject(
        this.minioClientService.bucket,
        filename,
      );
      this.logger.log(`File deleted successfully: ${filename}`);
    } catch (error) {
       throw new InternalServerErrorException(error);
    }
  }

  async getPresignedUrl(filename: string, expiry: number = 3600) {
    try {
      const url = await this.minioClientService.client.presignedGetObject(
        this.minioClientService.bucket,
        filename,
        expiry,
      );
      this.logger.log(`Presigned URL generated successfully: ${filename}`);
      return url;
    } catch (error) {
       throw new InternalServerErrorException(error);
    }
  }

  async getFileStream(filename: string, range?: string): Promise<{ stream: Stream; size: number; contentType: string; contentRange?: string }> {
    try {
      const stat = await this.minioClientService.client.statObject(this.minioClientService.bucket, filename);

      let stream: Stream;
      let contentRange: string | undefined;
      let contentLength = stat.size;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        let validRange = true;
        if (start >= stat.size) {
             validRange = false;
        }

        if (validRange) {
          const chunkSize = (end - start) + 1;
          contentLength = chunkSize;
          stream = await this.minioClientService.client.getPartialObject(
              this.minioClientService.bucket,
              filename,
              start,
              chunkSize
          );
          contentRange = `bytes ${start}-${end}/${stat.size}`;

          this.analyticsService.trackDownload(filename, chunkSize);
        } else {
           // Fallback for invalid range
           stream = await this.minioClientService.client.getObject(
              this.minioClientService.bucket,
              filename,
           );
           this.analyticsService.trackDownload(filename, stat.size);
        }

      } else {
         stream = await this.minioClientService.client.getObject(
            this.minioClientService.bucket,
            filename,
         );
         this.analyticsService.trackDownload(filename, stat.size);
      }

      this.logger.log(`File stream generated successfully: ${filename}`);
      return {
        stream,
        size: contentLength,
        contentType: stat.metaData['content-type'] || 'application/octet-stream',
        contentRange,
      };


    } catch (error) {
      if (error.code === 'NotFound') {
        throw new NotFoundException('File not found');
      }
      throw new InternalServerErrorException(error);
    }
  }
}
