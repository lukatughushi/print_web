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
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** multipart/form-data with a single `file` field. */
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
    const { file, stream, contentType } = await this.filesService.open(id);
    if (asAttachment) {
      // ?download=1&name=PR-123-front.png saves the file instead of opening it.
      const filename = String(name || file.filename || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    stream.on('error', () => res.status(500).end()).pipe(res);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.remove(id, user);
  }
}
