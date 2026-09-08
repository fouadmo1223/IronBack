import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AccessDecision, AttendanceSource } from '../../../common/enums';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true, collection: 'attendance' })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', required: true, index: true })
  member!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null, index: true })
  branch!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', default: null, index: true })
  subscription!: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  checkInAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  checkedInBy!: Types.ObjectId | null;

  @Prop({ type: String, enum: AttendanceSource, default: AttendanceSource.QR_CAMERA })
  source!: AttendanceSource;

  @Prop({ type: String, enum: AccessDecision, required: true, index: true })
  accessStatus!: AccessDecision;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ member: 1, checkInAt: -1 });
AttendanceSchema.index({ checkInAt: -1, accessStatus: 1 });
