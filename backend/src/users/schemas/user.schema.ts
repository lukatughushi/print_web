import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum Role {
  User = 'user',
  Admin = 'admin',
}

// One-time e-mail links (stored as SHA-256 hashes) and a password waiting
// for confirmation; never sent to the client.
const SECRET_FIELDS = [
  'verifyTokenHash', 'verifyTokenExpires', 'verifySentAt',
  'resetTokenHash', 'resetTokenExpires',
  'pendingPassword', 'pendingPasswordTokenHash', 'pendingPasswordExpires',
];

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      delete ret.password;
      delete ret.__v;
      for (const key of SECRET_FIELDS) delete ret[key];
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Excluded from queries by default; use .select('+password') when needed.
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.User })
  role: Role;

  // Delivery details, pre-filled at checkout.
  @Prop({ default: '', trim: true })
  phone: string;

  @Prop({ default: '', trim: true })
  city: string;

  @Prop({ default: '', trim: true })
  address: string;

  // Favourite product ids, synced from the browser when signed in.
  @Prop({ type: [String], default: [] })
  favorites: string[];

  // false until the e-mail link is opened. Accounts made before e-mail
  // checks existed have no value and count as verified.
  @Prop()
  emailVerified?: boolean;

  @Prop({ select: false }) verifyTokenHash?: string;
  @Prop({ select: false }) verifyTokenExpires?: Date;
  @Prop({ select: false }) verifySentAt?: Date;

  @Prop({ select: false }) resetTokenHash?: string;
  @Prop({ select: false }) resetTokenExpires?: Date;

  // New password (already hashed) applied when the e-mailed link is opened.
  @Prop({ select: false }) pendingPassword?: string;
  @Prop({ select: false }) pendingPasswordTokenHash?: string;
  @Prop({ select: false }) pendingPasswordExpires?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
