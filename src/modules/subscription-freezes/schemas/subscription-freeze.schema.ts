import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubscriptionFreezeStatus } from '../../../common/enums';

export type SubscriptionFreezeDocument = HydratedDocument<SubscriptionFreeze>;

@Schema({ timestamps: true, collection: 'subscription_freezes' })
export class SubscriptionFreeze {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscription!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', required: true, index: true })
  member!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({ required: true, min: 1 })
  numberOfDays!: number;

  @Prop({ trim: true, default: '' })
  reason!: string;

  @Prop({
    type: String,
    enum: SubscriptionFreezeStatus,
    default: SubscriptionFreezeStatus.PENDING,
    index: true,
  })
  status!: SubscriptionFreezeStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  requestedBy!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  @Prop({ trim: true, default: '' })
  decisionNote!: string;

  /** Set once the freeze window has elapsed and the subscription was reactivated. */
  @Prop({ default: false })
  released!: boolean;
}

export const SubscriptionFreezeSchema = SchemaFactory.createForClass(SubscriptionFreeze);
SubscriptionFreezeSchema.index({ status: 1, endDate: 1 });
