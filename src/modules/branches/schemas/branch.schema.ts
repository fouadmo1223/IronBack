import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: Number, default: null })
  lat!: number | null;

  @Prop({ type: Number, default: null })
  lng!: number | null;
}
const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  nameAr!: string;

  @Prop({ required: true, trim: true })
  nameEn!: string;

  @Prop({ trim: true, default: '' })
  addressAr!: string;

  @Prop({ trim: true, default: '' })
  addressEn!: string;

  @Prop({ trim: true, default: '' })
  cityAr!: string;

  @Prop({ trim: true, default: '' })
  cityEn!: string;

  @Prop({ trim: true, default: '' })
  phone!: string;

  @Prop({ type: GeoPointSchema, default: () => ({ lat: null, lng: null }) })
  geo!: GeoPoint;

  @Prop({ default: 'Africa/Cairo' })
  timezone!: string;

  @Prop({ default: false, index: true })
  isPrimary!: boolean;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
