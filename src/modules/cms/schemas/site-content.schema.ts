import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SiteContentDocument = HydratedDocument<SiteContent>;

/** Singleton (key = "site"): everything shared across every public page. */
@Schema({ timestamps: true, collection: 'site_content' })
export class SiteContent {
  @Prop({ required: true, unique: true, default: 'site' })
  key!: string;

  @Prop({ type: Object, default: {} })
  brand!: Record<string, unknown>; // { logoUrl, logoDarkUrl, accentColor, nameAr, nameEn }

  @Prop({ type: [Object], default: [] })
  navItems!: Array<Record<string, unknown>>; // { labelAr, labelEn, href, order }

  @Prop({ type: Object, default: {} })
  footer!: Record<string, unknown>; // { taglineAr, taglineEn, columns[], bottomNote }

  @Prop({ type: Object, default: {} })
  contact!: Record<string, unknown>; // { phone, whatsapp, email, addressAr, addressEn, mapUrl, hours }

  @Prop({ type: Object, default: {} })
  social!: Record<string, unknown>; // { instagram, facebook, tiktok, youtube, x }

  @Prop({ type: Object, default: {} })
  hours!: Record<string, unknown>; // { menWeekday, menWeekend, womenWeekday, womenWeekend }

  @Prop({ type: Object, default: {} })
  media!: Record<string, unknown>; // image overrides: { hero, athleteBack, ..., gallery: string[] }

  @Prop({ type: Object, default: {} })
  copy!: Record<string, unknown>; // per-locale message overrides: { en: {...}, ar: {...} } deep-merged over the i18n catalog

  @Prop({ type: Object, default: {} })
  seoDefaults!: Record<string, unknown>;
}

export const SiteContentSchema = SchemaFactory.createForClass(SiteContent);
