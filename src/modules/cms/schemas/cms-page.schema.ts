import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CmsSectionType } from '../../../common/enums';

@Schema({ _id: false })
export class CmsSeo {
  @Prop({ default: '' }) titleAr!: string;
  @Prop({ default: '' }) titleEn!: string;
  @Prop({ default: '' }) descriptionAr!: string;
  @Prop({ default: '' }) descriptionEn!: string;
  @Prop({ default: '' }) ogImageUrl!: string;
  @Prop({ type: [String], default: [] }) keywords!: string[];
}
const CmsSeoSchema = SchemaFactory.createForClass(CmsSeo);

@Schema({ _id: false })
export class CmsSection {
  @Prop({ required: true }) key!: string;

  @Prop({ type: String, enum: CmsSectionType, required: true })
  type!: CmsSectionType;

  @Prop({ default: true }) enabled!: boolean;
  @Prop({ default: 0 }) order!: number;

  /** Type-specific content. Shape is enforced by the dashboard editor + DTO. */
  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;
}
const CmsSectionSchema = SchemaFactory.createForClass(CmsSection);

export type CmsPageDocument = HydratedDocument<CmsPage>;

@Schema({ timestamps: true, collection: 'cms_pages' })
export class CmsPage {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug!: string;

  @Prop({ required: true }) nameAr!: string;
  @Prop({ required: true }) nameEn!: string;
  @Prop({ default: '' }) titleAr!: string;
  @Prop({ default: '' }) titleEn!: string;
  @Prop({ default: '' }) descriptionAr!: string;
  @Prop({ default: '' }) descriptionEn!: string;

  @Prop({ type: [CmsSectionSchema], default: [] })
  sections!: CmsSection[];

  @Prop({ type: CmsSeoSchema, default: () => ({}) })
  seo!: CmsSeo;

  @Prop({ default: false }) isPublished!: boolean;
  @Prop({ type: Date, default: null }) publishedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) updatedBy!: Types.ObjectId | null;
}

export const CmsPageSchema = SchemaFactory.createForClass(CmsPage);
