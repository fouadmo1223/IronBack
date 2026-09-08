import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlan>;

@Schema({ timestamps: true, collection: 'subscription_plans' })
export class SubscriptionPlan {
  @Prop({ required: true, trim: true })
  nameAr!: string;

  @Prop({ required: true, trim: true })
  nameEn!: string;

  @Prop({ trim: true, default: '' })
  descriptionAr!: string;

  @Prop({ trim: true, default: '' })
  descriptionEn!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  /** Explicit — never inferred from the plan name. */
  @Prop({ required: true, min: 1 })
  durationDays!: number;

  /** 0 = unlimited visits for the period. */
  @Prop({ default: 0, min: 0 })
  allowedVisits!: number;

  @Prop({ default: 0, min: 0 })
  freezeDays!: number;

  @Prop({ type: [String], default: [] })
  featuresAr!: string[];

  @Prop({ type: [String], default: [] })
  featuresEn!: string[];

  @Prop({ default: false })
  isFeatured!: boolean;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  displayOrder!: number;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
SubscriptionPlanSchema.index({ isActive: 1, displayOrder: 1 });
