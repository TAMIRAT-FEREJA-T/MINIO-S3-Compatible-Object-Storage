import { Injectable, InternalServerErrorException, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { MinioClientService } from '../minio/minio-client.service';
import { Stream } from 'stream';
import { AnalyticsService } from '../analytics/analytics.service';
import { BufferedFile } from 'src/minio/file.interface';
import { v4 as uuidv4 } from 'uuid';
import { fromBuffer } from 'file-type';
import bold from 'chalk';
import { not } from 'rxjs/internal/util/not';

@Injectable()
export class FileService {
  constructor(
    private readonly minioClientService: MinioClientService,
    private readonly analyticsService: AnalyticsService,
  ) { }
  private readonly logger = new Logger(FileService.name);

  async uploadFile(file: BufferedFile) {
    if (!file) return;

    // Check actual binary content
    const detected = await fromBuffer(file.buffer as Buffer);
    if (!detected || !this.isAllowedMime(detected.mime)) {
      this.logger.warn(`Rejected file upload. Detected MIME: ${detected?.mime}, Original: ${file.originalname}`);
      throw new BadRequestException('Invalid file content detected!');
    }

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

    const safeOriginalName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .toLowerCase();



    const metaData = {
      'Content-Type': file.mimetype,
      'Original-Name': file.originalname, // Keep strict original in metadata
      'x-amz-meta-original-name': safeOriginalName,
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
      this.logger.error(`Error uploading file: ${objectKey}`, error);
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

  private isAllowedMime(mime: string): boolean {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/mov', 'video/quicktime',
      'audio/mpeg', 'audio/wav',
      'audio/mp3',
      'audio/ogg',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-word',

    ];
    return allowedMimes.includes(mime);
  }

  private getCategoryFromMimetype(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'videos';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('text/') || mimetype === 'application/pdf' || mimetype.includes('word') || mimetype.includes('document')) return 'documents';
    return 'others';
  }



  async getPresignedUrl(filename: string, expiry: number = 300) {
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


  async deleteFile(filename: string) {
    try {
      await this.minioClientService.client.removeObject(
        this.minioClientService.bucket,
        filename,
      );
      this.logger.log(`File deleted successfully: ${filename}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${filename}`, error);
      throw new InternalServerErrorException(error);
    }
  }


  async downloadFile(filename: string) {
    try {
      const stat = await this.minioClientService.client.statObject(
        this.minioClientService.bucket,
        filename,
      );

      const stream = await this.minioClientService.client.getObject(
        this.minioClientService.bucket,
        filename,
      );

      return {
        stream,
        size: stat.size,
        contentType: stat.metaData['content-type'] || 'application/octet-stream',
        originalName: stat.metaData['original-name'] || filename,
      };
    } catch (error) {
      this.logger.error(`Error downloading file: ${filename}`, error);
      if (error.code === 'NotFound') {
        throw new NotFoundException('File not found');
      }
      throw new InternalServerErrorException(error);
    }
  }



  async getFileStream(
    filename: string,
    range?: string
  ): Promise<{
    stream: Stream;
    size: number;
    contentType: string;
    contentRange?: string
  }> {
    try {
      const stat = await this.minioClientService.client.statObject(
        this.minioClientService.bucket,
        filename
      );

      // More robust range parsing
      const parsedRange = this.parseRange(range as string, stat.size);

      if (parsedRange === null && range) {
        throw new HttpException(
          'Range Not Satisfiable',
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }


      const streamOptions = parsedRange
        ? {
          start: parsedRange.start,
          end: parsedRange.end
        }
        : undefined;

      const stream = streamOptions
        ? await this.minioClientService.client.getPartialObject(
          this.minioClientService.bucket,
          filename,
          streamOptions.start,
          streamOptions.end - streamOptions.start + 1
        )
        : await this.minioClientService.client.getObject(
          this.minioClientService.bucket,
          filename
        );

      // Track download with more precise size
      const downloadSize = streamOptions
        ? streamOptions.end - streamOptions.start + 1
        : stat.size;

      this.analyticsService.trackDownload(filename, downloadSize);

      return {
        stream,
        size: downloadSize,
        contentType: stat.metaData['content-type'] || 'application/octet-stream',
        ...(parsedRange && {
          contentRange: `bytes ${parsedRange.start}-${parsedRange.end}/${stat.size}`
        }),
      };
    } catch (error) {
      this.handleFileStreamError(error, filename);
    }
  }

  // Robust range parsing
  private parseRange(range: string, fileSize: number): { start: number; end: number } | null {
    if (!range) return null;

    try {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (start < 0 || start >= fileSize || end >= fileSize) {
        return null;
      }

      return {
        start,
        end: Math.min(end, fileSize - 1)
      };
    } catch {
      return null;
    }
  }

  // Centralized error handling
  private handleFileStreamError(error: any, filename: string): never {
    this.logger.error(`Error getting file stream for file: ${filename}`, error);

    if (error.code === 'NotFound') {
      throw new NotFoundException('File not found');
    }

    throw new InternalServerErrorException('Failed to stream file');
  }

}
