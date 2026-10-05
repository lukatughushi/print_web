import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

// SVG is excluded on purpose: served inline it can execute scripts.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: Number(config.get('MAX_UPLOAD_MB', 10)) * 1024 * 1024 },
        fileFilter: (_req, file, cb) =>
          ALLOWED_TYPES.includes(file.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false),
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
