import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A garment colour added in admin. */
export class CustomColorDto {
  @IsString() @Matches(/^[a-z0-9_-]{1,40}$/) key: string;
  @IsString() @MaxLength(40) name: string;
  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) hex: string;
}

/** A design on one of the home hero's rack garments. */
export class CustomCategoryDto {
  /** Stored on products; upper-case letters, digits and _. */
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,29}$/) code: string;
  @IsString() @MinLength(1) @MaxLength(40) label: string;
  @IsOptional() @IsString() @MaxLength(40) en?: string;
  @IsOptional() @IsString() @MaxLength(40) ru?: string;
}

export class CategoriesDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) hidden: string[];
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => CustomCategoryDto)
  custom: CustomCategoryDto[];
}

export class HeroRackItemDto {
  @IsInt() @Min(0) @Max(9) slot: number;
  @IsString() @Matches(/^[a-f0-9]{24}$/i) image: string;
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
  @IsNumber() @Min(0.05) @Max(1) scale: number;
  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) hex: string;
}

/** One home-page category tile. */
export class HomeTileDto {
  @IsString() @MinLength(1) @MaxLength(40) label: string;
  @IsOptional() @IsString() @MaxLength(40) en?: string;
  @IsOptional() @IsString() @MaxLength(40) ru?: string;
  /** Shop categories the tile opens (and whose lowest price it shows). */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @Matches(/^[A-Z][A-Z0-9_]{1,29}$/, { each: true }) cats: string[];
  /** GridFS id, or "builtin:<name>" for a picture bundled with the site. */
  @IsString() @Matches(/^([a-f0-9]{24}|builtin:[a-z0-9-]{1,30})$/i) image: string;
  /** A real photo: cropped a little higher so faces / logos stay in view. */
  @IsOptional() @IsBoolean() photo?: boolean;
  @IsOptional() @IsBoolean() hidden?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(300) announcementText?: string;
  @IsOptional() @IsBoolean() announcementActive?: boolean;
  @IsOptional() @IsString() @MaxLength(200) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(600) heroSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(80) heroCtaText?: string;
  @IsOptional() @IsString() @MaxLength(300) heroCtaLink?: string;
  @IsOptional() @IsString() @MaxLength(20) proofNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) proofText?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) freeShipThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) shippingFee?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) regionShippingFee?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(60) @Matches(/^[+0-9 ]*$/, { message: 'ტელეფონის ნომერი არასწორია' }) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(200) contactAddress?: string;
  @IsOptional() @IsString() @MaxLength(500) pickupText?: string;
  @IsOptional() @IsString() @MaxLength(30) @Matches(/^[+0-9 ]*$/, { message: 'ნომერი არასწორია' }) chatWhatsapp?: string;
  @IsOptional() @IsString() @MaxLength(30) @Matches(/^[+0-9 ]*$/, { message: 'ნომერი არასწორია' }) chatViber?: string;
  @IsOptional() @IsString() @MaxLength(200) chatMessenger?: string;
  @IsOptional() @IsObject() i18n?: Record<string, Record<string, string>>;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => CustomColorDto)
  customColors?: CustomColorDto[];
  @IsOptional() @ValidateNested() @Type(() => CategoriesDto)
  categories?: CategoriesDto;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => HeroRackItemDto)
  heroRack?: HeroRackItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(24) @ValidateNested({ each: true }) @Type(() => HomeTileDto)
  homeTiles?: HomeTileDto[];
}
