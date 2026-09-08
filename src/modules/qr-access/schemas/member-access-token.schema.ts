import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemberAccessTokenDocument = HydratedDocument<MemberAccessToken>;

/**
 * A member's access **credential** — identity only, never entitlement.
 *
 * The QR image encodes the opaque `token`; scans are matched by `tokenHash`, by
 * the printed `cardCode`, or by the member code. Whether the scan is *allowed*
 * (expired / frozen / visit cap / daily cap) is decided live by the attendance
 * service against the member's current subscription — this document deliberately
 * carries no subscription link and no expiry.
 *
 * One physical card (or digital token) follows a member across renewals: it is
 * created once, and only staff ever turn it off (`isActive` + `revokedAt`).
 */
@Schema({ timestamps: true, collection: 'member_access_tokens' })
export class MemberAccessToken {
  /** Null while the card sits in the unassigned pool (pre-printed batch). */
  @Prop({ type: Types.ObjectId, ref: 'MemberProfile', default: null, index: true })
  member!: Types.ObjectId | null;

  /** Human-readable code printed on the physical card, e.g. "A7K2P9QX". */
  @Prop({ type: String, default: null, unique: true, sparse: true, uppercase: true, trim: true })
  cardCode!: string | null;

  /** UNASSIGNED = in the pool; ASSIGNED = bound to a member. */
  @Prop({ type: String, enum: ['UNASSIGNED', 'ASSIGNED'], default: 'ASSIGNED', index: true })
  status!: 'UNASSIGNED' | 'ASSIGNED';

  @Prop({ required: true, select: false })
  token!: string;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  /** Staff kill-switch. A pooled card is inactive until assigned. */
  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  /** Set when staff disable/regenerate — a revoked credential is never revived. */
  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export const MemberAccessTokenSchema = SchemaFactory.createForClass(MemberAccessToken);

// At most one active credential per member (compound key avoids clashing with
// the plain `member` index used for pool / resolve lookups).
MemberAccessTokenSchema.index(
  { member: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, member: { $type: 'objectId' } },
    name: 'uniq_active_member',
  },
);
