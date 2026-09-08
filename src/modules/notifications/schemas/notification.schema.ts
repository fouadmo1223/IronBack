import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from '../../../common/enums';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true, index: true })
  type!: NotificationType;

  @Prop({ required: true }) titleAr!: string;
  @Prop({ required: true }) titleEn!: string;
  @Prop({ required: true }) messageAr!: string;
  @Prop({ required: true }) messageEn!: string;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: false, index: true })
  isRead!: boolean;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
