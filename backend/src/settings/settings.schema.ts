import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Site-wide storefront settings: a single document (key = 'site'). */
@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class Settings {
  @Prop({ default: 'site', unique: true })
  key: string;

  @Prop({ default: '★ 2 400+ დაბეჭდილი შეკვეთა · ბეჭდვა 3 დღეში · მიწოდება მთელ საქართველოში' })
  announcementText: string;

  @Prop({ default: true })
  announcementActive: boolean;

  @Prop({ default: 'დაბეჭდე საკუთარი დიზაინი' })
  heroTitle: string;

  @Prop({
    default:
      'ატვირთე სურათი ან დაწერე ტექსტი, აწყვე დიზაინი პირდაპირ ბრაუზერში და მიიღე მზა პროდუქტი 3 დღეში. მინიმალური შეკვეთა — 1 ცალი.',
  })
  heroSubtitle: string;

  @Prop({ default: 'დაიწყე დიზაინი' })
  heroCtaText: string;

  @Prop({ default: '' })
  heroCtaLink: string;

  /** Order subtotal (₾) from which delivery is free. */
  @Prop({ default: 150, min: 0 })
  freeShipThreshold: number;

  /** Delivery fee (₾) below the free-shipping threshold. */
  @Prop({ default: 10, min: 0 })
  shippingFee: number;

  @Prop({ default: '₾' })
  currency: string;

  @Prop({ default: '+995 555 12 34 56' })
  contactPhone: string;

  @Prop({ default: 'info@prenta.ge' })
  contactEmail: string;

  @Prop({ default: 'თბილისი, ჭავჭავაძის 12' })
  contactAddress: string;
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
