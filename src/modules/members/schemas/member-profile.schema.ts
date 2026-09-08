import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Gender } from '../../../common/enums';

export type MemberProfileDocument = HydratedDocument<MemberProfile>;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ trim: true, default: '' })
  name!: string;

  @Prop({ trim: true, default: '' })
  phone!: string;

  @Prop({ trim: true, default: '' })
  relation!: string;
}
const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);

@Schema({ _id: false })
export class StoredImage {
  @Prop({ default: '' })
  url!: string;

  @Prop({ default: '' })
  secureUrl!: string;

  @Prop({ default: '' })
  publicId!: string;
}
const StoredImageSchema = SchemaFactory.createForClass(StoredImage);

@Schema({ timestamps: true, collection: 'member_profiles' })
export class MemberProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user!: Types.ObjectId;

  /** Human-readable code, e.g. IRON-000001. NOT the QR secret. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  memberCode!: string;

  @Prop({ type: StoredImageSchema, default: () => ({}) })
  profileImage!: StoredImage;

  @Prop({ type: Date, default: null })
  dateOfBirth!: Date | null;

  @Prop({ type: String, enum: Gender, default: null })
  gender!: Gender | null;

  @Prop({ type: Date, default: () => new Date() })
  joinDate!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null, index: true })
  primaryBranch!: Types.ObjectId | null;

  @Prop({ type: EmergencyContactSchema, default: () => ({}) })
  emergencyContact!: EmergencyContact;

  @Prop({ default: true })
  qrEnabled!: boolean;

  /** Max approved check-ins allowed per calendar day. 0 = unlimited. */
  @Prop({ type: Number, default: 0, min: 0 })
  dailyCheckInLimit!: number;

  /** Denormalized pointer to the member's current subscription for fast lists. */
  @Prop({ type: Types.ObjectId, ref: 'Subscription', default: null, index: true })
  currentSubscription!: Types.ObjectId | null;
}

export const MemberProfileSchema = SchemaFactory.createForClass(MemberProfile);
MemberProfileSchema.index({ createdAt: -1 });
