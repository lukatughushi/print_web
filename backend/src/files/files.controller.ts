import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { parseFileRef, PRIVATE_OWNER } from './file-signature';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** multipart/form-data with a single `file` field. Admin only (product images); customers' images go through /me/media. */
  @Roles(Role.Admin)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('No file uploaded (expected field "file")');
    return this.filesService.upload(file, user);
  }

  @Public()
  @Get(':id')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('download') asAttachment?: string,
    @Query('name') name?: string,
  ) {
    // A customer's private file needs its signed reference ("<id>.<sig>").
    const ref = parseFileRef(id);
    const { file, stream, contentType } = await this.filesService.open(ref.id, (meta) =>
      meta?.ownerId !== PRIVATE_OWNER || ref.signed,
    );
    const isPrivate = file.metadata?.ownerId === PRIVATE_OWNER;
    if (asAttachment) {
      // ?download=1&name=PR-123-front.png saves the file instead of opening it.
      const filename = String(name || file.filename || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(file.length),
      'Cache-Control': isPrivate ? 'private, max-age=86400' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    stream.on('error', () => res.status(500).end()).pipe(res);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.remove(id, user);
  }
}
