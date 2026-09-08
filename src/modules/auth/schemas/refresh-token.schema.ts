import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

/**
 * One row per issued refresh token (rotation family tracked by `jti`).
 * The raw token never touches the database — only its SHA-256 hash.
 */
@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  jti!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  replacedByJti!: string | null;

  @Prop({ default: '' })
  userAgent!: string;

  @Prop({ default: '' })
  ipAddress!: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
// TTL cleanup 30 days after expiry.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
