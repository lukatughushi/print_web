import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, isValidObjectId, mongo } from 'mongoose';
import { Readable } from 'node:stream';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Role } from '../users/schemas/user.schema';

const BUCKET = 'uploads';

/**
 * Stores uploads in MongoDB GridFS so files survive Render's ephemeral disk.
 * Multer keeps the upload in memory (size-limited in FilesModule) and we
 * stream the buffer into the bucket.
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private bucket: mongo.GridFSBucket;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.bucket = new mongo.GridFSBucket(this.connection.db!, { bucketName: BUCKET });
  }

  upload(file: Express.Multer.File, owner: AuthUser) {
    return new Promise<{ id: string; filename: string; contentType: string; size: number }>(
      (resolve, reject) => {
        const stream = this.bucket.openUploadStream(file.originalname, {
          metadata: { ownerId: owner.id, contentType: file.mimetype },
        });
        Readable.from(file.buffer)
          .pipe(stream)
          .on('error', reject)
          .on('finish', () =>
            resolve({
              id: stream.id.toString(),
              filename: file.originalname,
              contentType: file.mimetype,
              size: file.size,
            }),
          );
      },
    );
  }

  async open(id: string) {
    const file = await this.findFile(id);
    return {
      file,
      stream: this.bucket.openDownloadStream(file._id),
      contentType: (file.metadata?.contentType as string) ?? 'application/octet-stream',
    };
  }

  async remove(id: string, user: AuthUser) {
    const file = await this.findFile(id);
    if (user.role !== Role.Admin && file.metadata?.ownerId !== user.id) {
      throw new ForbiddenException('You can only delete your own files');
    }
    await this.bucket.delete(file._id);
    return { deleted: true };
  }

  private async findFile(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('File not found');
    const [file] = await this.bucket.find({ _id: new mongo.ObjectId(id) }).limit(1).toArray();
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
