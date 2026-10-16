import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A garment colour added in admin. */
export class CustomColorDto {
  @IsString() @Matches(/^[a-z0-9_-]{1,40}$/) key: string;
  @IsString() @MaxLength(40) name: string;
  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) hex: string;
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
  @IsOptional() @IsNumber() @Min(0) freeShipThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) shippingFee?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(60) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(200) contactAddress?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => CustomColorDto)
  customColors?: CustomColorDto[];
}
