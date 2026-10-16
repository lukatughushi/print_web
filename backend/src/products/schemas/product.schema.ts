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

  // Children's sizes, set in admin. Unset = the default list (see kids-sizes.ts).
  @Prop({ type: [String], default: undefined })
  kidsSizes?: string[];

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

  // Switched off in admin when the product runs out: it stays visible but
  // can't be ordered.
  @Prop({ default: true })
  inStock: boolean;

  // Managed on the admin Constructor page, separately from the shop: the
  // product a constructor tab orders (one per category). It can be ordered
  // from the constructor even when hidden from the shop (isActive false).
  @Prop({ default: false, index: true })
  inConstructor: boolean;

  // Switched off in admin to drop the tab from the constructor.
  @Prop({ default: true })
  constructorEnabled: boolean;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
