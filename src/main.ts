import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bold from 'chalk';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger(AppModule.name);
  const configService = app.get(ConfigService);
  await app.listen(process.env.APP_PORT ?? 3000);
  logger.log(bold.blue(`minio file service is running on: ${await app.getUrl()}`));
  app.enableCors(

    {
      origin: configService.get('ALLOWED_ORIGINS'), // Allow specific origins listed in env
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true, // Allow credentials (cookies, authorization headers, etc.)
    }
  )
  process.on('SIGINT', (stream) => {
    app.close().then(() => {
      logger.log(bold.red(`${configService.get('APP_NAME')} is shutting down gracefully...`));
      process.exit(0);
    }).catch((error) => {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    });
  });
}

bootstrap();
