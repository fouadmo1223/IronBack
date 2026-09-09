import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContactMessageDocument = HydratedDocument<ContactMessage>;

export type ContactMessageStatus = 'NEW' | 'READ' | 'ARCHIVED';

@Schema({ timestamps: true, collection: 'contact_messages' })
export class ContactMessage {
  @Prop({ trim: true, required: true, maxlength: 120 })
  name!: string;

  @Prop({ trim: true, lowercase: true, required: true, maxlength: 160 })
  email!: string;

  @Prop({ trim: true, required: true, maxlength: 40 })
  phone!: string;

  @Prop({ trim: true, required: true, maxlength: 4000 })
  message!: string;

  @Prop({ type: String, enum: ['NEW', 'READ', 'ARCHIVED'], default: 'NEW', index: true })
  status!: ContactMessageStatus;

  @Prop({ trim: true, default: '' })
  ipAddress!: string;

  @Prop({ trim: true, default: '', maxlength: 400 })
  userAgent!: string;

  /** Staff user who first opened it. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  readBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;
}

export const ContactMessageSchema = SchemaFactory.createForClass(ContactMessage);
ContactMessageSchema.index({ createdAt: -1 });
