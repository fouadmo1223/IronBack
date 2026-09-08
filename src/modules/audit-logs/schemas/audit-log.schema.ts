import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditAction } from '../../../common/enums';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user!: Types.ObjectId | null;

  @Prop({ default: '' })
  userLabel!: string;

  @Prop({ type: String, enum: AuditAction, required: true, index: true })
  action!: AuditAction;

  @Prop({ required: true, index: true })
  entityType!: string;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  entityId!: Types.ObjectId | null;

  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: '' })
  ipAddress!: string;

  @Prop({ default: '' })
  userAgent!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
