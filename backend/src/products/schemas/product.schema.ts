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

  // GridFS file id (see FilesModule) or an external image URL.
  @Prop()
  image?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
