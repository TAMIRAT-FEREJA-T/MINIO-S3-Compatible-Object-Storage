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
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import type { BufferedFile } from '../minio/file.interface';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}
  private readonly logger = new Logger(FileController.name);

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))

  async uploadFile(@UploadedFile() file: BufferedFile) {
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

  @Delete(':filename')
  async deleteFile(@Param('filename') filename: string) {
    this.logger.log('Deleting file: ' + filename);
    await this.fileService.deleteFile(filename);
    return { message: 'File deleted successfully' };
  }

  @Get('download/:filename')
  async downloadFile(
    @Param('filename') filename: string,
    @Headers('range') range: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Downloading file: ' + filename);
    const { stream, size, contentType, contentRange } = await this.fileService.getFileStream(filename, range);

    res.set({
      'Content-Type': contentType,
      'Content-Length': size,
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    if (contentRange) {
        res.status(206);
        res.set('Content-Range', contentRange);
    }

    return new StreamableFile(stream as any);
  }
}
