import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Site-wide storefront settings: a single document (key = 'site').
 *  Texts default to empty: the storefront shows only what admin fills in. */
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Settings {
  @Prop({ default: 'site', unique: true })
  key: string;

  @Prop({ default: '' })
  announcementText: string;

  @Prop({ default: true })
  announcementActive: boolean;

  @Prop({ default: '' })
  heroTitle: string;

  @Prop({ default: '' })
  heroSubtitle: string;

  @Prop({ default: '' })
  heroCtaText: string;

  @Prop({ default: '' })
  heroCtaLink: string;

  /** Orders line under the home hero: "10 000+ …". */
  @Prop({ default: '10 000+' })
  proofNumber: string;

  @Prop({ default: 'შესრულებული საცალო შეკვეთა' })
  proofText: string;

  /** Order subtotal (₾) from which delivery is free. */
  @Prop({ default: 150, min: 0 })
  freeShipThreshold: number;

  /** Delivery fee (₾) below the free-shipping threshold. */
  @Prop({ default: 10, min: 0 })
  shippingFee: number;

  @Prop({ default: '₾' })
  currency: string;

  @Prop({ default: '' })
  contactPhone: string;

  @Prop({ default: '' })
  contactEmail: string;

  @Prop({ default: '' })
  contactAddress: string;

  /** Floating chat button: WhatsApp / Viber numbers and a Messenger page. Empty = hidden. */
  @Prop({ default: '' })
  chatWhatsapp: string;

  @Prop({ default: '' })
  chatViber: string;

  @Prop({ default: '' })
  chatMessenger: string;

  /**
   * English and Russian versions of the admin texts, e.g.
   * { en: { announcementText: '…' }, ru: { … } }. Empty = the Georgian text
   * (run through the site dictionary).
   */
  @Prop({ type: Object, default: {} })
  i18n: Record<string, Record<string, string>>;

  /** Garment colours added in admin, on top of the built-in palette. */
  @Prop({ type: [{ _id: false, key: String, name: String, hex: String }], default: [] })
  customColors: { key: string; name: string; hex: string }[];
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
