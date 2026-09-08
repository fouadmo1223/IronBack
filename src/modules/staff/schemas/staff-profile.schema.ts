import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StaffProfileDocument = HydratedDocument<StaffProfile>;

@Schema({ timestamps: true, collection: 'staff_profiles' })
export class StaffProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null, index: true })
  branch!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  role!: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  jobTitleAr!: string;

  @Prop({ trim: true, default: '' })
  jobTitleEn!: string;

  @Prop({ type: Date, default: () => new Date() })
  hiredAt!: Date;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const StaffProfileSchema = SchemaFactory.createForClass(StaffProfile);
