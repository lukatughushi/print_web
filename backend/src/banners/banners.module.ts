import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { isValidObjectId, Model } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FilesModule } from '../files/files.module';
import { FilesService } from '../files/files.service';
import { Role } from '../users/schemas/user.schema';

/* ── Schema ─────────────────────────────────────────────── */

// Home page slider banner. `image` is a GridFS file id (see FilesModule);
// `imageUrl` (virtual) is the path the storefront loads it from.
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Banner {
  @Prop({ required: true })
  image: string;

  @Prop({ default: '' }) title: string;
  @Prop({ default: '' }) subtitle: string;
  @Prop({ default: '' }) ctaText: string;
  @Prop({ default: '' }) ctaLink: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) isActive: boolean;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
BannerSchema.virtual('imageUrl').get(function (this: Banner) {
  return isValidObjectId(this.image) ? `/api/files/${this.image}` : this.image;
});

/* ── DTOs ───────────────────────────────────────────────── */

export class CreateBannerDto {
  @IsString() @MaxLength(300) image: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(60) ctaText?: string;
  @IsOptional() @IsString() @MaxLength(300) ctaLink?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class ReorderBannersDto {
  @IsArray() @ArrayMaxSize(100) @IsMongoId({ each: true }) ids: string[];
}

/* ── Service ────────────────────────────────────────────── */

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private readonly bannerModel: Model<Banner>,
    private readonly files: FilesService,
  ) {}

  findActive() {
    return this.bannerModel.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).exec();
  }

  findAll() {
    return this.bannerModel.find().sort({ order: 1, createdAt: 1 }).exec();
  }

  async create(dto: CreateBannerDto) {
    const last = await this.bannerModel.findOne().sort({ order: -1 }).exec();
    return this.bannerModel.create({ ...dto, order: (last?.order ?? -1) + 1 });
  }

  async update(id: string, dto: UpdateBannerDto) {
    const banner = await this.find(id);
    const oldImage = banner.image;
    Object.assign(banner, dto);
    await banner.save();
    if (dto.image && dto.image !== oldImage) await this.files.removeById(oldImage);
    return banner;
  }

  async remove(id: string) {
    const banner = await this.find(id);
    await banner.deleteOne();
    await this.files.removeById(banner.image);
    return { deleted: true };
  }

  async reorder(ids: string[]) {
    await Promise.all(ids.map((id, order) => this.bannerModel.updateOne({ _id: id }, { order }).exec()));
    return this.findAll();
  }

  private async find(id: string) {
    const banner = isValidObjectId(id) ? await this.bannerModel.findById(id).exec() : null;
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}

/* ── Controller ─────────────────────────────────────────── */

@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Public()
  @Get()
  findActive() {
    return this.banners.findActive();
  }

  @Roles(Role.Admin)
  @Get('all')
  findAll() {
    return this.banners.findAll();
  }

  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Roles(Role.Admin)
  @Patch('reorder')
  reorder(@Body() dto: ReorderBannersDto) {
    return this.banners.reorder(dto.ids);
  }

  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.banners.remove(id);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]), FilesModule],
  controllers: [BannersController],
  providers: [BannersService],
})
export class BannersModule {}
