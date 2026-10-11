import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { countBy, paginate, PageQuery, searchRegex } from '../common/pagination';
import { FilesModule } from '../files/files.module';
import { FilesService } from '../files/files.service';
import { Role } from '../users/schemas/user.schema';

/* ── Schema ─────────────────────────────────────────────── */

export enum QuoteStatus {
  New = 'NEW',
  Contacted = 'CONTACTED',
  Won = 'WON',
  Lost = 'LOST',
}

const PRODUCTS = ['tee', 'polo', 'ls', 'hoodie', 'cap', 'bag', 'vest'] as const;
const ZONES = ['front', 'back', 'sleeve'] as const;

/** Corporate (B2B) quote request from the /corporate page. */
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Quote {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ default: '', trim: true }) company: string;
  /** Phone number or e-mail, as the customer typed it. */
  @Prop({ required: true, trim: true }) contact: string;
  @Prop({ default: '' }) comment: string;

  // Calculator selection at the time of the request.
  @Prop() product?: string;
  @Prop() quantity?: number;
  @Prop({ type: [String], default: [] }) zones: string[];
  @Prop() estimate?: number;

  /** Uploaded logo (GridFS file id) and its original name. */
  @Prop() logoFile?: string;
  @Prop() logoName?: string;

  @Prop({ type: String, enum: QuoteStatus, default: QuoteStatus.New, index: true })
  status: QuoteStatus;

  @Prop({ default: '' }) adminNote: string;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
QuoteSchema.virtual('number').get(function (this: { _id: Types.ObjectId }) {
  return `B2B-${this._id.toString().slice(-5).toUpperCase()}`;
});

/* ── DTOs ───────────────────────────────────────────────── */

export class CreateQuoteDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsString() @MinLength(5) @MaxLength(120) contact: string;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @IsIn(PRODUCTS) product?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) quantity?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(ZONES, { each: true }) zones?: string[];
  @IsOptional() @IsNumber() @Min(0) estimate?: number;
  /** data: URL of the logo (PNG, JPEG, WebP or PDF, up to 10 MB). */
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() @MaxLength(200) logoName?: string;
}

export class UpdateQuoteDto {
  @IsOptional() @IsEnum(QuoteStatus) status?: QuoteStatus;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}

/* ── Service ────────────────────────────────────────────── */

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_LOGO_BYTES = 10 * 1024 * 1024;

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private readonly quoteModel: Model<Quote>,
    private readonly files: FilesService,
  ) {}

  async create(dto: CreateQuoteDto) {
    const { logo, logoName, ...rest } = dto;
    let logoFile: string | undefined;
    if (logo) {
      const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(logo);
      const buffer = match ? Buffer.from(match[2], 'base64') : null;
      if (!match || !LOGO_TYPES.includes(match[1]) || !buffer?.length) {
        throw new BadRequestException('ლოგო უნდა იყოს PNG, JPG, WebP ან PDF');
      }
      if (buffer.length > MAX_LOGO_BYTES) throw new BadRequestException('ლოგო 10 MB-ზე დიდია');
      logoFile = await this.files.uploadBuffer(buffer, logoName || 'logo', match[1]);
    }
    try {
      return await this.quoteModel.create({ ...rest, logoFile, logoName });
    } catch (err) {
      await this.files.removeById(logoFile);
      throw err;
    }
  }

  /** One page of requests plus per-status counts (for the filter tabs). */
  async findAll(query: { status?: string; q?: string } & PageQuery) {
    const search: Record<string, unknown> = {};
    const rx = searchRegex(query.q);
    if (rx) {
      const or: Record<string, unknown>[] = [{ name: rx }, { company: rx }, { contact: rx }];
      const tail = query.q!.trim().replace(/^B2B-/i, '').toLowerCase();
      if (/^[0-9a-f]{4,24}$/.test(tail)) {
        or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${tail}$` } } });
      }
      search.$or = or;
    }
    const filter = { ...search };
    if (query.status && Object.values(QuoteStatus).includes(query.status as QuoteStatus)) filter.status = query.status;
    const [page, counts] = await Promise.all([
      paginate(this.quoteModel, filter, query),
      countBy(this.quoteModel, search, 'status'),
    ]);
    return { ...page, counts };
  }

  async findOne(id: string) {
    const quote = isValidObjectId(id) ? await this.quoteModel.findById(id).exec() : null;
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  countNew() {
    return this.quoteModel.countDocuments({ status: QuoteStatus.New }).exec();
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const quote = isValidObjectId(id) ? await this.quoteModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).exec() : null;
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }
}

/* ── Controller ─────────────────────────────────────────── */

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Roles(Role.Admin)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.quotes.findAll({ status, q, page, pageSize });
  }

  @Roles(Role.Admin)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotes.findOne(id);
  }

  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Quote.name, schema: QuoteSchema }]), FilesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
