import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { createHash } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FilesModule } from '../files/files.module';
import { FilesService } from '../files/files.service';
import { User } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';

/* ── Limits ─────────────────────────────────────────────── */

const MAX_IMAGE_MB = 10;
const MAX_MEDIA = 300;
const MAX_DESIGNS = 100;
const MAX_FAVORITES = 500;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const FILE_URL = /^\/api\/files\/([a-f0-9]{24})$/;

/* ── Schemas ────────────────────────────────────────────── */

/** An image in the customer's library (stored in GridFS, deduplicated by hash). */
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Media {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) fileId: string;
  @Prop({ required: true }) hash: string;
  @Prop({ default: '' }) name: string;
  @Prop({ required: true }) contentType: string;
  @Prop({ required: true }) size: number;
}
export const MediaSchema = SchemaFactory.createForClass(Media);
MediaSchema.index({ userId: 1, hash: 1 }, { unique: true });
MediaSchema.virtual('url').get(function (this: Media) {
  return `/api/files/${this.fileId}`;
});

/** A saved constructor design, reusable as a template. */
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class SavedDesign {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  /** Constructor tab id (tshirt, hoodie, mug …). */
  @Prop({ required: true }) tab: string;
  @Prop() productId?: string;
  /** Shop category (TSHIRT, MUG …) for labels. */
  @Prop() category?: string;
  @Prop({ default: 'white' }) color: string;
  /** { front: { images, texts }, back: { images, texts } }; image srcs point at /api/files/:id. */
  @Prop({ type: Object, required: true }) data: Record<string, unknown>;
  /** Library media used by this design (blocks deleting them). */
  @Prop({ type: [String], default: [] }) mediaIds: string[];
  @Prop() previewFile?: string;
}
export const SavedDesignSchema = SchemaFactory.createForClass(SavedDesign);
SavedDesignSchema.virtual('previewUrl').get(function (this: SavedDesign) {
  return this.previewFile ? `/api/files/${this.previewFile}` : '';
});

/* ── DTOs ───────────────────────────────────────────────── */

class ProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
}

class PasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}

class FavoritesDto {
  @IsArray() @ArrayMaxSize(MAX_FAVORITES) @IsString({ each: true }) ids: string[];
}

class MediaDto {
  @IsString() dataUrl: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}

class DesignSideDto {
  @IsArray() @ArrayMaxSize(60) images: Record<string, unknown>[];
  @IsArray() @ArrayMaxSize(60) texts: Record<string, unknown>[];
}

class DesignDataDto {
  @IsObject() @ValidateNested() @Type(() => DesignSideDto) front: DesignSideDto;
  @IsObject() @ValidateNested() @Type(() => DesignSideDto) back: DesignSideDto;
}

class SaveDesignDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsString() @MaxLength(40) tab: string;
  @IsOptional() @IsString() @MaxLength(40) productId?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
  @IsObject() @ValidateNested() @Type(() => DesignDataDto) data: DesignDataDto;
  @IsOptional() @IsString() preview?: string;
}

class RenameDesignDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}

/* ── Helpers ────────────────────────────────────────────── */

function parseDataUrl(dataUrl: string) {
  const m = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new BadRequestException('სურათის ფორმატი არასწორია');
  const contentType = m[1].toLowerCase();
  if (!IMAGE_TYPES.includes(contentType)) {
    throw new BadRequestException('მხოლოდ PNG, JPG, WEBP ან GIF სურათი');
  }
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > MAX_IMAGE_MB * 1024 * 1024) {
    throw new BadRequestException(`სურათი ${MAX_IMAGE_MB} MB-ზე დიდია`);
  }
  return { contentType, buffer };
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/* ── Service ────────────────────────────────────────────── */

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Media.name) private readonly mediaModel: Model<Media>,
    @InjectModel(SavedDesign.name) private readonly designModel: Model<SavedDesign>,
    private readonly files: FilesService,
    private readonly users: UsersService,
  ) {}

  /* Profile */

  async updateProfile(userId: string, dto: ProfileDto) {
    const set = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v).trim()]),
    );
    const user = await this.userModel.findByIdAndUpdate(userId, { $set: set }, { returnDocument: 'after' }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async changePassword(user: AuthUser, dto: PasswordDto) {
    const found = await this.users.findByEmailWithPassword(user.email);
    if (!found || !(await this.users.comparePassword(dto.currentPassword, found.password))) {
      // 400, not 401: the client signs out on a 401 (expired session).
      throw new BadRequestException({ message: 'მიმდინარე პაროლი არასწორია', code: 'WRONG_PASSWORD' });
    }
    await this.users.setPassword(user.id, dto.newPassword);
    return { ok: true };
  }

  async setFavorites(userId: string, ids: string[]) {
    const clean = [...new Set(ids.filter((id) => isValidObjectId(id)))];
    await this.userModel.updateOne({ _id: userId }, { $set: { favorites: clean } }).exec();
    return { ids: clean };
  }

  /* Media library */

  listMedia(userId: string) {
    return this.mediaModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  /** Stores an image in the library, or returns the existing copy of the same file. */
  async addMedia(userId: string, dataUrl: string, name = '') {
    const { contentType, buffer } = parseDataUrl(dataUrl);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.mediaModel.findOne({ userId, hash }).exec();
    if (existing) return existing;
    if ((await this.mediaModel.countDocuments({ userId })) >= MAX_MEDIA) {
      throw new BadRequestException(`ბიბლიოთეკაში მაქსიმუმ ${MAX_MEDIA} სურათი ეტევა — წაშალე ძველები`);
    }
    const filename = (name || `image.${EXT[contentType]}`).slice(0, 120);
    const fileId = await this.files.uploadBuffer(buffer, filename, contentType, userId);
    try {
      return await this.mediaModel.create({ userId, fileId, hash, name: filename, contentType, size: buffer.length });
    } catch (err) {
      // Same image uploaded twice at once: keep the first copy.
      await this.files.removeById(fileId);
      const again = await this.mediaModel.findOne({ userId, hash }).exec();
      if (again) return again;
      throw err;
    }
  }

  async removeMedia(userId: string, id: string) {
    const media = isValidObjectId(id) ? await this.mediaModel.findOne({ _id: id, userId }).exec() : null;
    if (!media) throw new NotFoundException('სურათი ვერ მოიძებნა');
    const usedBy = await this.designModel.countDocuments({ userId, mediaIds: media.id }).exec();
    if (usedBy > 0) {
      throw new BadRequestException(`ეს სურათი ${usedBy} შენახულ დიზაინშია გამოყენებული — ჯერ ის დიზაინი წაშალე`);
    }
    await media.deleteOne();
    await this.files.removeById(media.fileId);
    return { deleted: true };
  }

  /* Designs */

  listDesigns(userId: string) {
    return this.designModel.find({ userId }).select('-data').sort({ updatedAt: -1 }).exec();
  }

  async getDesign(userId: string, id: string) {
    const design = isValidObjectId(id) ? await this.designModel.findOne({ _id: id, userId }).exec() : null;
    if (!design) throw new NotFoundException('დიზაინი ვერ მოიძებნა');
    return design;
  }

  /** Moves embedded images into the library and points the design at them. */
  private async storeImages(userId: string, data: DesignDataDto) {
    const mediaIds = new Set<string>();
    const sides: Record<string, unknown> = {};
    for (const side of ['front', 'back'] as const) {
      const images = [];
      for (const img of data[side].images) {
        const src = typeof img.src === 'string' ? img.src : '';
        let next = img;
        if (src.startsWith('data:')) {
          const media = await this.addMedia(userId, src, typeof img.name === 'string' ? img.name : '');
          mediaIds.add(media.id);
          next = { ...img, src: `/api/files/${media.fileId}` };
        } else {
          const fileId = FILE_URL.exec(src)?.[1];
          const media = fileId ? await this.mediaModel.findOne({ userId, fileId }).exec() : null;
          if (media) mediaIds.add(media.id);
        }
        images.push(next);
      }
      sides[side] = { images, texts: data[side].texts };
    }
    return { data: sides, mediaIds: [...mediaIds] };
  }

  private async storePreview(userId: string, preview?: string) {
    if (!preview) return undefined;
    const { contentType, buffer } = parseDataUrl(preview);
    return this.files.uploadBuffer(buffer, `design-preview.${EXT[contentType]}`, contentType, userId);
  }

  async createDesign(userId: string, dto: SaveDesignDto) {
    if ((await this.designModel.countDocuments({ userId })) >= MAX_DESIGNS) {
      throw new BadRequestException(`მაქსიმუმ ${MAX_DESIGNS} დიზაინის შენახვა შეიძლება — წაშალე ძველები`);
    }
    const { data, mediaIds } = await this.storeImages(userId, dto.data);
    const previewFile = await this.storePreview(userId, dto.preview);
    const design = await this.designModel.create({
      userId, name: dto.name.trim(), tab: dto.tab, productId: dto.productId, category: dto.category, color: dto.color || 'white',
      data, mediaIds, previewFile,
    });
    return this.withoutData(design);
  }

  async updateDesign(userId: string, id: string, dto: SaveDesignDto) {
    const design = await this.getDesign(userId, id);
    const { data, mediaIds } = await this.storeImages(userId, dto.data);
    const previewFile = await this.storePreview(userId, dto.preview);
    const oldPreview = design.previewFile;
    design.set({
      name: dto.name.trim(), tab: dto.tab, productId: dto.productId, category: dto.category, color: dto.color || 'white',
      data, mediaIds, ...(previewFile ? { previewFile } : {}),
    });
    await design.save();
    if (previewFile && oldPreview) await this.files.removeById(oldPreview);
    return this.withoutData(design);
  }

  async renameDesign(userId: string, id: string, name: string) {
    const design = await this.getDesign(userId, id);
    design.name = name.trim();
    await design.save();
    return this.withoutData(design);
  }

  async removeDesign(userId: string, id: string) {
    const design = await this.getDesign(userId, id);
    await design.deleteOne();
    await this.files.removeById(design.previewFile);
    return { deleted: true };
  }

  private withoutData(design: { toJSON: () => Record<string, unknown> }) {
    const { data: _data, ...rest } = design.toJSON();
    return rest;
  }
}

/* ── Controller: everything is scoped to the signed-in user ─ */

@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('profile')
  profile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.account.updateProfile(user.id, dto);
  }

  @Post('password')
  @HttpCode(200)
  password(@CurrentUser() user: AuthUser, @Body() dto: PasswordDto) {
    return this.account.changePassword(user, dto);
  }

  @Put('favorites')
  favorites(@CurrentUser() user: AuthUser, @Body() dto: FavoritesDto) {
    return this.account.setFavorites(user.id, dto.ids);
  }

  @Get('media')
  media(@CurrentUser() user: AuthUser) {
    return this.account.listMedia(user.id);
  }

  @Post('media')
  addMedia(@CurrentUser() user: AuthUser, @Body() dto: MediaDto) {
    return this.account.addMedia(user.id, dto.dataUrl, dto.name);
  }

  @Delete('media/:id')
  removeMedia(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.account.removeMedia(user.id, id);
  }

  @Get('designs')
  designs(@CurrentUser() user: AuthUser) {
    return this.account.listDesigns(user.id);
  }

  @Get('designs/:id')
  design(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.account.getDesign(user.id, id);
  }

  @Post('designs')
  createDesign(@CurrentUser() user: AuthUser, @Body() dto: SaveDesignDto) {
    return this.account.createDesign(user.id, dto);
  }

  @Put('designs/:id')
  updateDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveDesignDto) {
    return this.account.updateDesign(user.id, id, dto);
  }

  @Patch('designs/:id')
  renameDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenameDesignDto) {
    return this.account.renameDesign(user.id, id, dto.name);
  }

  @Delete('designs/:id')
  removeDesign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.account.removeDesign(user.id, id);
  }
}

@Module({
  imports: [
    UsersModule,
    FilesModule,
    MongooseModule.forFeature([
      { name: Media.name, schema: MediaSchema },
      { name: SavedDesign.name, schema: SavedDesignSchema },
    ]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}

