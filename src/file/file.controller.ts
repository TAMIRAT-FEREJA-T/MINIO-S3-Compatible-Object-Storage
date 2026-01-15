import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Delete,
  Get,
  Headers,
  Res,
  StreamableFile,
  Logger,
  ParseFilePipe,
  MaxFileSizeValidator,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import type { BufferedFile } from '../minio/file.interface';
import path from 'path';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) { }
  private readonly logger = new Logger(FileController.name);

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 550 * 1024 * 1024 })], // 550MB
      }),
    )
    file: BufferedFile,
  ) {
    this.logger.log('Uploading file: ' + file.originalname);
    return await this.fileService.uploadFile(file);
  }

  @Post('presigned-url')
  async getPresignedUrl(@Body('filename') filename: string) {
    this.logger.log('Generating presigned URL for file: ' + filename);
    return {
      url: await this.fileService.getPresignedUrl(filename),
    };
  }



  @Delete(':filename/*')
  async deleteFile(@Param('filename') filename: string) {
    this.logger.log('Deleting file: ' + filename);
    await this.fileService.deleteFile(filename);
    return { message: 'File deleted successfully' };
  }

  @Get('download/*')
  async downloadFile(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filename = req.url.split('download/')[1];
    const decodedFilename = decodeURIComponent(filename);
    this.logger.log('Downloading file: ' + decodedFilename);

    const file = await this.fileService.downloadFile(decodedFilename);

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
      'Content-Length': file.size.toString(),
    });

    return new StreamableFile(file.stream);
  }


  @Get('stream/*')
  async streamFile(
    @Req() req: Request,
    @Headers('range') range: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const filename = req.url.split('stream/')[1];
      const decodedFilename = decodeURIComponent(filename);

      const {
        stream,
        size,
        contentType,
        contentRange
      } = await this.fileService.getFileStream(decodedFilename, range);

      // More robust content disposition
      const disposition = this.determineContentDisposition(contentType);

      // Set headers more efficiently
      res.set({
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Content-Disposition': `${disposition}; filename="${path.basename(decodedFilename)}"`,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        ...(contentRange && { 'Content-Range': contentRange }),
      });

      // Set status conditionally
      if (contentRange) {
        res.status(206);
      }

      // Use pipeline for better error handling
      return new StreamableFile(stream as any);
    } catch (error) {
      this.logger.error(`Download error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Helper method for content disposition
  private determineContentDisposition(contentType: string): string {
    const inlineTypes = [
      'video/',
      'audio/',
      'image/',
      'application/pdf'
    ];

    return inlineTypes.some(type => contentType.startsWith(type))
      ? 'inline'
      : 'attachment';
  }


}
