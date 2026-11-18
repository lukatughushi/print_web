import { signFileId } from '../../files/file-signature';
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

/** Online payment state (card / Apple Pay / Google Pay through Bank of Georgia). */
export enum PaymentStatus {
  Unpaid = 'unpaid',
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Refunded = 'refunded',
  PartlyRefunded = 'refunded_partially',
}

/** Every method an order may carry; 'cash' and 'bog' remain for older orders. */
export const PAYMENT_METHODS = ['cash', 'card', 'bog', 'transfer'] as const;
/** Methods offered at checkout: card (BOG). 'transfer' remains for older orders. */
export const CHECKOUT_PAYMENT_METHODS = ['card'] as const;

/** How the order reaches the customer. */
export const DELIVERY_METHODS = ['tbilisi', 'region', 'pickup'] as const;

/** Money returned to the customer through BOG, with the admin's reason. */
@Schema({ _id: false })
export class OrderRefund {
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ required: true, trim: true }) reason: string;
  @Prop({ required: true }) at: Date;
  /** Admin who made it (e-mail). */
  @Prop({ default: '' }) by: string;
}

/** Customer design attached to a line. Ids are GridFS files (see FilesModule). */
@Schema({ _id: false })
export class OrderDesign {
  /** Front print: artwork-only PNG, trimmed to the artwork. */
  @Prop() printFile?: string;
  /** Front mockup: the garment with the design, showing where it is printed. */
  @Prop() previewFile?: string;
  /** Back print / mockup, when the back side has a design. */
  @Prop() backPrintFile?: string;
  @Prop() backPreviewFile?: string;
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

// The design's files are the customer's: sent out only as signed references.
const DESIGN_FILES = ['printFile', 'previewFile', 'backPrintFile', 'backPreviewFile', 'layersFile'] as const;

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      for (const item of ret.items ?? []) {
        if (!item?.design) continue;
        for (const key of DESIGN_FILES) if (item.design[key]) item.design[key] = signFileId(String(item.design[key]));
      }
      return ret;
    },
  },
})
export class Order {
  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ required: true, trim: true }) customerName: string;
  @Prop({ trim: true, lowercase: true, index: true }) customerEmail?: string;
  @Prop({ required: true, trim: true }) phone: string;
  /** Courier in Tbilisi, courier to the regions, or picked up at the studio. */
  @Prop({ enum: DELIVERY_METHODS, default: 'tbilisi' }) delivery: string;
  /** City and street for a courier; empty for a pickup. */
  @Prop({ default: '', trim: true }) address: string;
  /** Lets a customer without an account pay for and check this order. */
  @Prop({ select: false }) guestKey?: string;
  @Prop({ default: '' }) notes: string;
  @Prop({ enum: PAYMENT_METHODS, default: 'card' }) payment: string;

  @Prop({ required: true, min: 0 }) subtotal: number;
  @Prop({ required: true, min: 0 }) shipping: number;
  @Prop({ required: true, min: 0 }) total: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.Pending, index: true })
  status: OrderStatus;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.Unpaid, index: true })
  paymentStatus: PaymentStatus;

  /** Bank of Georgia's id for the payment. */
  @Prop({ index: true, sparse: true }) bogOrderId?: string;
  @Prop() paidAt?: Date;
  /** How it was paid on BOG's page: card, apple_pay, google_pay… */
  @Prop() paidWith?: string;
  /** Lari returned to the customer so far (as BOG reports it). */
  @Prop({ default: 0 }) refundedAmount: number;
  /** Refunds made from the admin panel, oldest first. */
  @Prop({ type: [OrderRefund], default: [] }) refunds: OrderRefund[];
  /** Why the order was cancelled (set by a full refund). */
  @Prop({ default: '' }) cancelReason: string;

  /** Internal note visible only in the admin panel. */
  @Prop({ default: '' }) adminNote: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

/** Short human order number shown to customers, e.g. PR-3F9A21. */
OrderSchema.virtual('number').get(function (this: { _id: Types.ObjectId }) {
  return `PR-${this._id.toString().slice(-6).toUpperCase()}`;
});
