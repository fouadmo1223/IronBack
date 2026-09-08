import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaFolder } from '../../../common/enums';

export type MediaAssetDocument = HydratedDocument<MediaAsset>;

/** Library entry for a Cloudinary asset used by the public site / profiles. */
@Schema({ timestamps: true, collection: 'media_assets' })
export class MediaAsset {
  @Prop({ required: true }) url!: string;
  @Prop({ required: true }) secureUrl!: string;
  @Prop({ required: true, unique: true }) publicId!: string;

  @Prop({ default: 0 }) width!: number;
  @Prop({ default: 0 }) height!: number;
  @Prop({ default: '' }) format!: string;
  @Prop({ default: 'image' }) resourceType!: string;
  @Prop({ default: 0 }) bytes!: number;

  @Prop({ type: String, enum: MediaFolder, default: MediaFolder.CMS, index: true })
  folder!: MediaFolder;

  @Prop({ trim: true, default: '' }) altAr!: string;
  @Prop({ trim: true, default: '' }) altEn!: string;
  @Prop({ trim: true, default: '' }) title!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  /** Free-form usage references ("cms:home.hero", "trainer:<id>") for delete-guarding. */
  @Prop({ type: [String], default: [] })
  usedBy!: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  uploadedBy!: Types.ObjectId | null;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
MediaAssetSchema.index({ createdAt: -1 });
MediaAssetSchema.index({ tags: 1 });
