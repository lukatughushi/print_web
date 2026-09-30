import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// `virtuals: true` adds a string `id` alongside `_id` (the frontend uses `product.id`).
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ trim: true, index: true })
  category?: string;

  // Colour keys (e.g. 'white', 'navy'); the storefront maps them to swatches.
  @Prop({ type: [String], default: [] })
  colors: string[];

  @Prop({ type: [String], default: [] })
  sizes: string[];

  @Prop({ trim: true })
  material?: string;

  // 'unisex' | 'men' | 'women'
  @Prop({ trim: true, default: 'unisex' })
  gender: string;

  // Pre-discount price; when set above `price` the product shows as on sale.
  @Prop({ min: 0 })
  oldPrice?: number;

  @Prop({ default: false })
  newArrival: boolean;

  // GridFS file id (see FilesModule) or an external image URL.
  @Prop()
  image?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
