import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageChannel, MessageLogStatus } from '../../../common/enums';

export type MessageLogDocument = HydratedDocument<MessageLog>;

@Schema({ timestamps: true, collection: 'message_logs' })
export class MessageLog {
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', default: null, index: true })
  member!: Types.ObjectId | null;

  @Prop({ default: '' }) phone!: string;
  @Prop({ default: '' }) templateKey!: string;

  @Prop({ type: String, enum: MessageChannel, default: MessageChannel.WHATSAPP_MANUAL })
  channel!: MessageChannel;

  @Prop({ required: true }) renderedText!: string;

  @Prop({ type: Object, default: {} })
  variables!: Record<string, string>;

  @Prop({ type: String, enum: MessageLogStatus, default: MessageLogStatus.GENERATED, index: true })
  status!: MessageLogStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  sentBy!: Types.ObjectId | null;
}

export const MessageLogSchema = SchemaFactory.createForClass(MessageLog);
MessageLogSchema.index({ createdAt: -1 });
