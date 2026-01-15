import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('overview')
    async getOverview() {
        return await this.analyticsService.getOverview();
    }

    @Get('top-downloads')
    async getTopDownloads(@Query('limit') limit: number) {
        return await this.analyticsService.getTopDownloads(limit ? Number(limit) : 5);
    }

    @Get('storage-by-type')
    async getStorageByMimeType() {
        return await this.analyticsService.getStorageByMimeType();
    }
}
