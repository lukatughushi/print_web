import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(300) announcementText?: string;
  @IsOptional() @IsBoolean() announcementActive?: boolean;
  @IsOptional() @IsString() @MaxLength(200) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(600) heroSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(80) heroCtaText?: string;
  @IsOptional() @IsString() @MaxLength(300) heroCtaLink?: string;
  @IsOptional() @IsNumber() @Min(0) freeShipThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) shippingFee?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(60) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(200) contactAddress?: string;
}
