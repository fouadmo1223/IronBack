import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AppSettingDocument = HydratedDocument<AppSetting>;

@Schema({ timestamps: true, collection: 'app_settings' })
export class AppSetting {
  @Prop({ required: true, unique: true, trim: true, index: true })
  key!: string;

  @Prop({ type: Object, default: null })
  value!: unknown;

  @Prop({ default: 'general', index: true })
  group!: string;

  @Prop({ default: '' })
  descriptionEn!: string;

  @Prop({ default: '' })
  descriptionAr!: string;

  /** When true the value is safe to expose on public endpoints. */
  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);
