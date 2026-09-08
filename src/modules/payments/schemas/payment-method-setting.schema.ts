import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentMethodType } from '../../../common/enums';

export type PaymentMethodSettingDocument = HydratedDocument<PaymentMethodSetting>;

/** Admin-configured manual transfer destination. Numbers live in the DB, never in code. */
@Schema({ timestamps: true, collection: 'payment_method_settings' })
export class PaymentMethodSetting {
  @Prop({ required: true, trim: true }) nameAr!: string;
  @Prop({ required: true, trim: true }) nameEn!: string;

  @Prop({ type: String, enum: PaymentMethodType, required: true })
  type!: PaymentMethodType;

  @Prop({ trim: true, default: '' }) accountName!: string;
  @Prop({ trim: true, default: '' }) accountNumber!: string;
  @Prop({ trim: true, default: '' }) phoneNumber!: string;
  @Prop({ trim: true, default: '' }) iban!: string;
  @Prop({ trim: true, default: '' }) bankNameAr!: string;
  @Prop({ trim: true, default: '' }) bankNameEn!: string;

  @Prop({ trim: true, default: '' }) instructionsAr!: string;
  @Prop({ trim: true, default: '' }) instructionsEn!: string;

  @Prop({ trim: true, default: '' }) logoUrl!: string;
  @Prop({ trim: true, default: '' }) logoPublicId!: string;

  @Prop({ default: true, index: true }) isActive!: boolean;
  @Prop({ default: 0 }) displayOrder!: number;
}

export const PaymentMethodSettingSchema = SchemaFactory.createForClass(PaymentMethodSetting);
PaymentMethodSettingSchema.index({ isActive: 1, displayOrder: 1 });
