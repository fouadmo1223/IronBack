import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentStatus } from '../../../common/enums';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ _id: false })
export class RefundRecord {
  @Prop({ default: 0 }) amount!: number;
  @Prop({ type: Date, default: null }) date!: Date | null;
  @Prop({ default: '' }) method!: string;
  @Prop({ default: '' }) reference!: string;
  @Prop({ default: '' }) note!: string;
  @Prop({ default: '' }) proofPublicId!: string;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) recordedBy!: Types.ObjectId | null;
}
const RefundRecordSchema = SchemaFactory.createForClass(RefundRecord);

/**
 * A single manual-transfer payment submission. Rejected / fake records are
 * kept forever for audit — never deleted.
 */
@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', required: true, index: true })
  member!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscription!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PaymentMethodSetting', default: null })
  paymentMethod!: Types.ObjectId | null;

  @Prop({ default: '' }) paymentMethodLabel!: string;

  @Prop({ required: true, min: 0 }) amount!: number;
  @Prop({ required: true, min: 0 }) expectedAmount!: number;

  // ─── Sender-supplied transfer details ───
  @Prop({ trim: true, default: '' }) senderName!: string;
  @Prop({ trim: true, default: '' }) senderPhone!: string;
  @Prop({ type: Date, default: null }) transferDate!: Date | null;
  @Prop({ trim: true, default: '' }) transactionReference!: string;

  // ─── Proof (stored privately in Cloudinary) ───
  @Prop({ default: '' }) proofImagePublicId!: string;
  @Prop({ default: '' }) proofImageUrl!: string;

  @Prop({ trim: true, default: '' }) memberNotes!: string;
  @Prop({ trim: true, default: '' }) adminNotes!: string;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.UNDER_REVIEW,
    index: true,
  })
  status!: PaymentStatus;

  @Prop({ trim: true, default: '' }) rejectionReason!: string;
  @Prop({ trim: true, default: '' }) internalReason!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) reviewedBy!: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) reviewedAt!: Date | null;
  @Prop({ type: Date, default: null }) approvedAt!: Date | null;
  @Prop({ type: Date, default: null }) rejectedAt!: Date | null;
  @Prop({ type: Date, default: null }) refundedAt!: Date | null;

  @Prop({ default: '' }) receiptNumber!: string;

  @Prop({ type: RefundRecordSchema, default: null })
  refund!: RefundRecord | null;

  /** True when a staff member logged a payment they physically received. */
  @Prop({ default: false }) recordedManually!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) createdBy!: Types.ObjectId | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ member: 1, createdAt: -1 });
PaymentSchema.index({ subscription: 1, status: 1 });
