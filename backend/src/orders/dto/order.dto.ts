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
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PAYMENT_METHODS } from '../schemas/order.schema';

export class OrderDesignDto {
  /** Editor layers; stored as a JSON file. */
  @IsOptional() @IsObject() canvasJson?: Record<string, unknown>;
  /** data: URLs (PNG/JPEG/WebP) produced by the editor. */
  @IsOptional() @IsString() printUrl?: string;
  @IsOptional() @IsString() previewUrl?: string;
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
  @IsString() @MinLength(5) @MaxLength(40) phone: string;
  @IsString() @MinLength(3) @MaxLength(300) address: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsIn(PAYMENT_METHODS) payment?: string;
  /** Total the customer saw; the order is refused if the server's differs. */
  @IsOptional() @IsNumber() expectedTotal?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}
