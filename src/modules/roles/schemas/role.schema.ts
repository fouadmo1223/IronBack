import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PermissionKey } from '../../../common/constants/permissions';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  /** Stable machine key, e.g. SUPER_ADMIN. Unique. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  nameAr!: string;

  @Prop({ required: true, trim: true })
  nameEn!: string;

  @Prop({ trim: true, default: '' })
  descriptionAr!: string;

  @Prop({ trim: true, default: '' })
  descriptionEn!: string;

  @Prop({ type: [String], default: [] })
  permissions!: PermissionKey[];

  /** System roles cannot be deleted and their key cannot change. */
  @Prop({ default: false })
  isSystem!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
