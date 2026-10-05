import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum OrderStatus {
  Pending = 'PENDING',
  Printing = 'PRINTING',
  Ready = 'READY_FOR_PICKUP',
  Shipped = 'SHIPPED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export const PAYMENT_METHODS = ['cash', 'card', 'bog'] as const;

/** Customer design attached to a line. Ids are GridFS files (see FilesModule). */
@Schema({ _id: false })
export class OrderDesign {
  /** Print-ready PNG rendered from the editor. */
  @Prop() printFile?: string;
  /** Small preview image shown in the cart / admin. */
  @Prop() previewFile?: string;
  /** Editor layers (JSON) so the design can be re-created. */
  @Prop() layersFile?: string;
  /** 3D model the design was made on (e.g. 'polo', 'mug'). */
  @Prop() model?: string;
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  // Snapshot at order time, so later catalogue edits don't change history.
  @Prop({ required: true }) name: string;
  @Prop() category?: string;
  @Prop({ default: '' }) size: string;
  @Prop() color?: string;
  @Prop({ required: true, min: 1 }) quantity: number;
  @Prop({ required: true, min: 0 }) unitPrice: number;
  @Prop({ required: true, min: 0 }) lineTotal: number;
  @Prop({ type: OrderDesign }) design?: OrderDesign;
}

@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Order {
  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ required: true, trim: true }) customerName: string;
  @Prop({ trim: true, lowercase: true, index: true }) customerEmail?: string;
  @Prop({ required: true, trim: true }) phone: string;
  @Prop({ required: true, trim: true }) address: string;
  @Prop({ default: '' }) notes: string;
  @Prop({ enum: PAYMENT_METHODS, default: 'cash' }) payment: string;

  @Prop({ required: true, min: 0 }) subtotal: number;
  @Prop({ required: true, min: 0 }) shipping: number;
  @Prop({ required: true, min: 0 }) total: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.Pending, index: true })
  status: OrderStatus;

  /** Internal note visible only in the admin panel. */
  @Prop({ default: '' }) adminNote: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

/** Short human order number shown to customers, e.g. PR-3F9A21. */
OrderSchema.virtual('number').get(function (this: { _id: Types.ObjectId }) {
  return `PR-${this._id.toString().slice(-6).toUpperCase()}`;
});
