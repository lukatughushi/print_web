import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, CHECKOUT_PAYMENT_METHODS, DELIVERY_METHODS } from '../schemas/order.schema';

export class OrderDesignDto {
  /** Editor layers; stored as a JSON file. */
  @IsOptional() @IsObject() canvasJson?: Record<string, unknown>;
  /** data: URLs (PNG/JPEG/WebP) produced by the editor. */
  @IsOptional() @IsString() printUrl?: string;
  @IsOptional() @IsString() previewUrl?: string;
  @IsOptional() @IsString() backPrintUrl?: string;
  @IsOptional() @IsString() backPreviewUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) model?: string;
}

export class OrderItemDto {
  @IsMongoId() productId: string;
  @IsOptional() @IsString() @MaxLength(20) size?: string;
  @IsOptional() @IsString() @MaxLength(50) color?: string;
  @IsInt() @Min(1) @Max(1000) quantity: number;
  @IsOptional() @ValidateNested() @Type(() => OrderDesignDto) design?: OrderDesignDto;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @IsOptional() @IsEmail() customerEmail?: string;
  // Digits and spaces, optionally a leading + (no dashes or letters).
  @IsString() @Matches(/^\+?[0-9 ]{9,20}$/, { message: 'ტელეფონის ნომერი არასწორია' }) phone: string;
  @IsOptional() @IsIn(DELIVERY_METHODS) delivery?: string;
  /** Required for a courier (checked in the service); ignored for a pickup. */
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsIn(CHECKOUT_PAYMENT_METHODS) payment?: string;
  /** Total the customer saw; the order is refused if the server's differs. */
  @IsOptional() @IsNumber() @Min(0) expectedTotal?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}
