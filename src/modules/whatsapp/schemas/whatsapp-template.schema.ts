import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppTemplateDocument = HydratedDocument<WhatsAppTemplate>;

@Schema({ timestamps: true, collection: 'whatsapp_templates' })
export class WhatsAppTemplate {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true }) nameAr!: string;
  @Prop({ required: true, trim: true }) nameEn!: string;

  /** Body with {{variable}} placeholders. */
  @Prop({ required: true }) bodyAr!: string;
  @Prop({ required: true }) bodyEn!: string;

  @Prop({ default: true }) isActive!: boolean;
  @Prop({ default: false }) isSystem!: boolean;
}

export const WhatsAppTemplateSchema = SchemaFactory.createForClass(WhatsAppTemplate);
