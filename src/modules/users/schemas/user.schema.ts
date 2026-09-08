import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AccountType, Language } from '../../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, trim: true, index: true })
  phone!: string;

  /** Argon2 hash. Never selected by default. */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, enum: AccountType, required: true, index: true })
  accountType!: AccountType;

  @Prop({ type: String, enum: Language, default: Language.AR })
  language!: Language;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  /** Populated for STAFF accounts. */
  @Prop({ type: Types.ObjectId, ref: 'StaffProfile', default: null })
  staffProfile!: Types.ObjectId | null;

  /** Populated for MEMBER accounts. */
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', default: null })
  memberProfile!: Types.ObjectId | null;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ accountType: 1, isActive: 1 });
UserSchema.virtual('fullName').get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`.trim();
});
UserSchema.set('toJSON', {
  virtuals: true,
  /* eslint-disable @typescript-eslint/no-explicit-any */
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
  /* eslint-enable @typescript-eslint/no-explicit-any */
});
