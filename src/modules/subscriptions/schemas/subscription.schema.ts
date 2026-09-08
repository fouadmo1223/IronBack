import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubscriptionStatus } from '../../../common/enums';

export type SubscriptionDocument = HydratedDocument<Subscription>;

/**
 * A single membership period. Renewing always creates a NEW document —
 * history is never overwritten. `status` holds the explicit lifecycle state;
 * EXPIRING_SOON / EXPIRED are derived at read time from the dates.
 */
@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', required: true, index: true })
  member!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true })
  plan!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null, index: true })
  branch!: Types.ObjectId | null;

  // ─── Plan snapshot (frozen at purchase for historical integrity) ───
  @Prop({ required: true }) planNameAr!: string;
  @Prop({ required: true }) planNameEn!: string;
  @Prop({ required: true, min: 1 }) durationDays!: number;
  @Prop({ default: 0 }) allowedVisits!: number;
  @Prop({ default: 0 }) planFreezeDays!: number;

  // ─── Dates ───
  @Prop({ type: Date, default: null }) startDate!: Date | null;
  @Prop({ type: Date, default: null }) endDate!: Date | null;

  // ─── Status ───
  @Prop({
    type: String,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING_PAYMENT,
    index: true,
  })
  status!: SubscriptionStatus;

  // ─── Pricing ───
  @Prop({ required: true, min: 0 }) basePrice!: number;
  @Prop({ default: 0, min: 0 }) discountAmount!: number;
  @Prop({ required: true, min: 0 }) finalPrice!: number;
  @Prop({ default: 0, min: 0 }) paidAmount!: number;
  @Prop({ default: 0 }) remainingAmount!: number;

  // ─── Usage / freeze ───
  @Prop({ default: 0, min: 0 }) visitsUsed!: number;
  @Prop({ default: 0, min: 0 }) freezeDaysUsed!: number;
  @Prop({ type: Date, default: null }) frozenAt!: Date | null;

  // ─── Audit trail ───
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) createdBy!: Types.ObjectId | null;
  @Prop({ type: Boolean, default: false }) selfServe!: boolean;
  @Prop({ type: Date, default: null }) activatedAt!: Date | null;
  @Prop({ type: Date, default: null }) cancelledAt!: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  cancelledBy!: Types.ObjectId | null;
  @Prop({ default: '' }) cancellationReason!: string;

  /** Set when this subscription was created as a renewal of another. */
  @Prop({ type: Types.ObjectId, ref: 'Subscription', default: null })
  renewedFrom!: Types.ObjectId | null;

  /** Guards against repeat lifecycle notifications from the scheduled sweep. */
  @Prop({ type: Date, default: null }) expiringNotifiedAt!: Date | null;
  @Prop({ type: Date, default: null }) expiredNotifiedAt!: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ member: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ createdAt: -1 });
