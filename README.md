# NestJS MinIO File Service

A high-performance, generic file service built with NestJS and MinIO.

## Features
- **Universal File Support**: Upload any file type.
- **Streaming**: Support for video playback and range requests (partial content).
- **Multipart Upload**: Efficient handling of large files using Multer.
- **Presigned URLs**: Secure, temporary access to files.
- **Analytics**: Tracks upload/download counts, bandwidth usage, and last access time using SQLite.
- **Docker Ready**: Includes docker-compose for MinIO and the application.

## Prerequisites
- Docker & Docker Compose
- Node.js (v18+)

## Setup

1. **Clone & Install**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Check `.env` file for MinIO credentials.
   ```env
   MINIO_ENDPOINT=localhost
   MINIO_PORT=9000
   MINIO_BUCKET_NAME=my-files
   MINIO_ROOT_USER=minioadmin
   MINIO_ROOT_PASSWORD=minioadmin
   ```

3. **Start MinIO**
   ```bash
   docker-compose up -d minio
   ```

4. **Run Application**
   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## API Endpoints

### Upload File
- **POST** `/file/upload`
- **Body**: `multipart/form-data` with field `file`.
- **Response**: JSON with filename, original name, size, url.

### Download File
- **GET** `/file/download/:filename`
- **Headers**: Supports `Range` header for streaming.

### Delete File
- **DELETE** `/file/:filename`

### Generate Presigned URL
- **POST** `/file/presigned-url`
- **Body**: `{ "filename": "example.jpg" }`

## Analytics
Metadata is stored in `analytics.db` (SQLite). The system tracks:
- File size distribution
- Upload/download timestamps
- Total bandwidth usage per file
- Download counts
