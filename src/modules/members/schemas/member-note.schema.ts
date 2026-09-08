import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemberNoteDocument = HydratedDocument<MemberNote>;

@Schema({ timestamps: true, collection: 'member_notes' })
export class MemberNote {
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', required: true, index: true })
  member!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  @Prop({ default: '' })
  createdByLabel!: string;
}

export const MemberNoteSchema = SchemaFactory.createForClass(MemberNote);
MemberNoteSchema.index({ member: 1, createdAt: -1 });
