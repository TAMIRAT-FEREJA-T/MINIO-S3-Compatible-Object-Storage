# NestJS MinIO File Service

A high-performance, generic file service built with NestJS and MinIO.

## Features
- **Secure File Storage**: Validates file content using "magic numbers" to ensure file type integrity (rejects spoofed extensions).
- **Smart Streaming**: Dedicated `/stream` endpoint supporting byte-range requests for video/audio playback.
- **Multipart Upload**: Efficient handling of large files (up to 550MB) using Multer.
- **Presigned URLs**: Secure, temporary access to private files.
- **Advanced Analytics**: Tracks upload/download counts, bandwidth usage, storage by MIME type, and last access time.
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

## Security
- **File Validation**: Files are checked against a whitelist of allowed MIME types using binary signature verification (magic bytes).
- **Filename Sanitization**: Original filenames are sanitized and prefixed with a UUID to prevent collisions and directory traversal attacks.
- **Path Organization**: Files are stored in a `YYYY-MM-DD/category/` structure.

## API Endpoints

### File Operations

#### POST `/file/upload`
- **Body**: `multipart/form-data` with field `file`.
- **Constraint**: Max file size 550MB.
- **Response**: JSON with filename, original name, size, url, mimetype.

#### GET `/file/download/:filename`
- **Description**: Standard download.
- **Headers**: Sets `Content-Disposition: attachment`.

#### GET `/file/stream/:filename`
- **Description**: Stream media content.
- **Headers**: Supports `Range` header. Sets `Content-Disposition` to `inline` for media types, enabling in-browser playback.

#### DELETE `/file/:filename`
- **Description**: Permanently remove a file.

#### POST `/file/presigned-url`
- **Body**: `{ "filename": "example.jpg" }`
- **Description**: Generate a temporary access URL.

### Analytics

#### GET `/analytics/overview`
- **Response**: `totalFiles`, `totalSize`, `totalBandwidth`.

#### GET `/analytics/top-downloads`
- **Query**: `?limit=5` (default 5).
- **Response**: List of most downloaded files.

#### GET `/analytics/storage-by-type`
- **Response**: Break-down of used storage per MIME type.
