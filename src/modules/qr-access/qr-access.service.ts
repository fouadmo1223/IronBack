import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as QRCode from 'qrcode';
import { AuditAction, SubscriptionStatus } from '../../common/enums';
import { generateCardCode, generateOpaqueToken, sha256 } from '../../common/utils/token.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MembersService } from '../members/members.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  MemberAccessToken,
  MemberAccessTokenDocument,
} from './schemas/member-access-token.schema';

export interface QrPayload {
  token: string;
  qrDataUrl: string;
  isActive: boolean;
  cardCode: string | null;
  updatedAt: Date;
}

export interface UnassignedCard {
  id: string;
  cardCode: string;
  qrDataUrl: string;
  createdAt: Date;
}

interface Actor {
  id?: string;
  label?: string;
  ip?: string;
  userAgent?: string;
}

const LIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.EXPIRING_SOON,
  SubscriptionStatus.FROZEN,
];

@Injectable()
export class QrAccessService {
  constructor(
    @InjectModel(MemberAccessToken.name)
    private readonly tokenModel: Model<MemberAccessTokenDocument>,
    private readonly membersService: MembersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private render(token: string): Promise<string> {
    return QRCode.toDataURL(`IRONGYM:${token}`, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }

  private async payload(doc: MemberAccessTokenDocument): Promise<QrPayload> {
    return {
      token: doc.token,
      qrDataUrl: await this.render(doc.token),
      isActive: doc.isActive,
      cardCode: doc.cardCode ?? null,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    };
  }

  /** True when the member currently holds a subscription that grants entry. */
  private async hasLiveSubscription(member: {
    _id: Types.ObjectId;
    currentSubscription?: unknown;
  }): Promise<boolean> {
    const cs = member.currentSubscription as
      | { _id?: unknown; status?: string; endDate?: string | Date | null }
      | Types.ObjectId
      | string
      | null
      | undefined;
    if (!cs) return false;

    const isLive = (status: unknown, endDate: string | Date | null | undefined) => {
      if (!LIVE_SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) return false;
      return !endDate || new Date(endDate).getTime() > Date.now();
    };

    // Already populated (e.g. from getByIdOrFail) — no extra query needed.
    if (typeof cs === 'object' && 'status' in cs && cs.status) {
      return isLive(cs.status, cs.endDate);
    }

    const id =
      typeof cs === 'object' && '_id' in cs && cs._id ? String(cs._id) : String(cs);
    const sub = await this.subscriptionsService.findRawById(id);
    if (!sub) return false;
    return isLive(sub.status, sub.endDate);
  }

  /* ───────────────────────── Member-facing ───────────────────────── */

  /**
   * The member's active credential. Self-heals: if they have no token but a live
   * subscription, one is issued now (covers members activated before auto-issue,
   * or where the activation-time issue failed). 404 only when genuinely not
   * entitled.
   */
  async getForMemberProfile(memberProfileId: string | Types.ObjectId): Promise<QrPayload> {
    const doc = await this.tokenModel
      .findOne({ member: memberProfileId, isActive: true })
      .select('+token')
      .exec();
    if (doc) return this.payload(doc);

    const member = await this.membersService.findRawById(memberProfileId);
    if (member && (await this.hasLiveSubscription(member))) {
      return this.ensureForMember(member._id, { label: 'System (self-heal)' });
    }
    throw new NotFoundException(
      'No access QR — it is issued when a subscription is activated or a card is assigned.',
    );
  }

  async getForMemberUser(userId: string): Promise<QrPayload> {
    const member = await this.membersService.getByUserIdOrFail(userId);
    if (!member.qrEnabled) {
      throw new ForbiddenException('QR access is disabled on your account');
    }

    const active = await this.tokenModel
      .findOne({ member: member._id, isActive: true })
      .select('+token')
      .exec();
    if (active) return this.payload(active);

    // No credential yet — self-heal only if the member is actually entitled.
    if (await this.hasLiveSubscription(member)) {
      return this.ensureForMember(member._id);
    }
    throw new NotFoundException(
      'No access QR — it is issued when your subscription is activated.',
    );
  }

  /* ───────────────────────── Credential lifecycle ───────────────────────── */

  private async createToken(input: {
    member?: string | Types.ObjectId | null;
    cardCode?: string | null;
    status: 'UNASSIGNED' | 'ASSIGNED';
    isActive: boolean;
  }): Promise<MemberAccessTokenDocument> {
    const raw = generateOpaqueToken(32);
    const base: Record<string, unknown> = {
      member: input.member ?? null,
      status: input.status,
      token: raw,
      tokenHash: sha256(raw),
      isActive: input.isActive,
    };
    // Only set cardCode when there is one — a card-less token must omit the
    // field entirely so the sparse unique index does not treat many as dupes.
    if (input.cardCode) base.cardCode = input.cardCode;
    const [doc] = await this.tokenModel.create([
      base,
    ]);
    doc.token = raw;
    return doc;
  }

  private async revokeActive(memberProfileId: string | Types.ObjectId): Promise<void> {
    await this.tokenModel
      .updateMany(
        { member: memberProfileId, isActive: true },
        { $set: { isActive: false, revokedAt: new Date() } },
      )
      .exec();
  }

  /**
   * Idempotent: guarantee the member has exactly one active credential.
   * - already active         → returned as-is
   * - holds an un-revoked assigned card → that card is re-activated (survives renewals)
   * - otherwise              → a fresh digital token is minted
   *
   * Safe to call on every subscription activation / renewal.
   */
  async ensureForMember(
    memberProfileId: string | Types.ObjectId,
    actor: Actor = { label: 'System' },
  ): Promise<QrPayload> {
    const active = await this.tokenModel
      .findOne({ member: memberProfileId, isActive: true })
      .select('+token')
      .exec();
    if (active) {
      await this.membersService.setQrEnabled(memberProfileId, true);
      return this.payload(active);
    }

    const card = await this.tokenModel
      .findOne({
        member: memberProfileId,
        cardCode: { $ne: null },
        status: 'ASSIGNED',
        revokedAt: null,
      })
      .select('+token')
      .sort({ updatedAt: -1 })
      .exec();

    let doc: MemberAccessTokenDocument;
    let reused = false;
    if (card) {
      card.isActive = true;
      await card.save();
      doc = card;
      reused = true;
    } else {
      doc = await this.mintMemberToken(memberProfileId);
    }

    await this.membersService.setQrEnabled(memberProfileId, true);
    await this.auditLogsService.record({
      action: AuditAction.QR_ISSUED,
      entityType: 'MemberProfile',
      entityId: new Types.ObjectId(String(memberProfileId)),
      actor,
      metadata: { cardCode: doc.cardCode ?? null, reusedCard: reused },
    });
    return this.payload(doc);
  }

  async regenerate(memberProfileId: string, actor: Actor): Promise<QrPayload> {
    await this.discardActive(memberProfileId);
    const doc = await this.mintMemberToken(memberProfileId);
    await this.membersService.setQrEnabled(memberProfileId, true);
    await this.auditLogsService.record({
      action: AuditAction.QR_REGENERATED,
      entityType: 'MemberProfile',
      entityId: new Types.ObjectId(memberProfileId),
      actor,
    });
    return this.payload(doc);
  }

  async disable(memberProfileId: string, actor: Actor): Promise<void> {
    await this.revokeActive(memberProfileId);
    await this.membersService.setQrEnabled(memberProfileId, false);
    await this.auditLogsService.record({
      action: AuditAction.QR_REVOKED,
      entityType: 'MemberProfile',
      entityId: new Types.ObjectId(memberProfileId),
      actor,
    });
  }

  /* ───────────────────────── Card pool ───────────────────────── */

  /** Random 8-char code; retries on the (rare) unique-index collision. */
  private async mintPoolCard(): Promise<MemberAccessTokenDocument> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        return await this.createToken({
          cardCode: generateCardCode(8),
          status: 'UNASSIGNED',
          isActive: false,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate a unique card code');
  }

  /**
   * Mint a fresh member-bound credential with an 8-char code, so every issued
   * QR carries the same style of printed code (e.g. `ZRBQYWSV`) rather than
   * falling back to the member code.
   */
  private async mintMemberToken(
    memberProfileId: string | Types.ObjectId,
  ): Promise<MemberAccessTokenDocument> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        return await this.createToken({
          member: memberProfileId,
          cardCode: generateCardCode(8),
          status: 'ASSIGNED',
          isActive: true,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate a unique card code');
  }

  /**
   * Drop every active credential a member holds (used when replacing it).
   * Returns the codes that were removed, for the audit trail.
   */
  private async discardActive(
    memberProfileId: string | Types.ObjectId,
  ): Promise<string[]> {
    const active = await this.tokenModel
      .find({ member: memberProfileId, isActive: true })
      .exec();
    const removed = active.map((t) => t.cardCode ?? t.tokenHash.slice(0, 8));
    if (active.length) {
      await this.tokenModel.deleteMany({
        _id: { $in: active.map((t) => t._id) },
      });
    }
    return removed;
  }

  /** Pre-generate a batch of unassigned QR cards for printing. */
  async generateBatch(count: number, actor: Actor): Promise<UnassignedCard[]> {
    const n = Math.min(200, Math.max(1, Math.floor(count)));
    const docs: MemberAccessTokenDocument[] = [];
    for (let i = 0; i < n; i += 1) docs.push(await this.mintPoolCard());

    const cards = await Promise.all(
      docs.map(async (doc) => ({
        id: String(doc._id),
        cardCode: doc.cardCode as string,
        qrDataUrl: await this.render(doc.token),
        createdAt: (doc as unknown as { createdAt: Date }).createdAt,
      })),
    );

    await this.auditLogsService.record({
      action: AuditAction.QR_BATCH_GENERATED,
      entityType: 'MemberAccessToken',
      actor,
      metadata: { count: n },
    });
    return cards;
  }

  async listUnassigned(limit = 120): Promise<UnassignedCard[]> {
    const docs = await this.tokenModel
      .find({ status: 'UNASSIGNED', member: null })
      .select('+token')
      .sort({ createdAt: -1 })
      .limit(Math.min(300, limit))
      .exec();
    return Promise.all(
      docs.map(async (d) => ({
        id: String(d._id),
        cardCode: d.cardCode ?? '',
        qrDataUrl: await this.render(d.token),
        createdAt: (d as unknown as { createdAt: Date }).createdAt,
      })),
    );
  }

  async countUnassigned(): Promise<number> {
    return this.tokenModel.countDocuments({ status: 'UNASSIGNED', member: null }).exec();
  }

  /**
   * Bind a pooled card to a member. Requires the member to be entitled (live
   * subscription) and to not already hold an active credential.
   */
  async assign(
    input: { cardCode?: string; token?: string; memberId: string; replace?: boolean },
    actor: Actor,
  ): Promise<QrPayload> {
    const claim: Record<string, unknown> = { status: 'UNASSIGNED', member: null };
    if (input.cardCode) {
      claim.cardCode = input.cardCode.trim().toUpperCase();
    } else if (input.token) {
      const raw = input.token.startsWith('IRONGYM:') ? input.token.slice(8) : input.token.trim();
      claim.tokenHash = sha256(raw);
    } else {
      throw new BadRequestException('Provide a card code or a scanned token.');
    }

    const member = await this.membersService.getByIdOrFail(input.memberId);

    const existingActive = await this.tokenModel
      .findOne({ member: member._id, isActive: true })
      .exec();
    if (existingActive && !input.replace) {
      throw new BadRequestException(
        'This member already has an active QR. Release it before assigning a new card.',
      );
    }
    let replacedCodes: string[] = [];
    if (existingActive && input.replace) {
      replacedCodes = await this.discardActive(member._id);
    }
    if (!(await this.hasLiveSubscription(member))) {
      throw new BadRequestException(
        'This member has no active subscription — a QR can only be assigned to an active member.',
      );
    }

    // Atomic claim: flips the card out of the pool only if it is still free.
    const card = await this.tokenModel
      .findOneAndUpdate(
        claim,
        {
          $set: {
            member: member._id,
            status: 'ASSIGNED',
            isActive: true,
            revokedAt: null,
          },
        },
        { new: true },
      )
      .select('+token')
      .exec();
    if (!card) {
      throw new NotFoundException('That card is not in the pool (already assigned, or unknown).');
    }

    await this.membersService.setQrEnabled(member._id, true);
    await this.auditLogsService.record({
      action: AuditAction.QR_ASSIGNED,
      entityType: 'MemberProfile',
      entityId: member._id,
      actor,
      metadata: { cardCode: card.cardCode, replaced: replacedCodes.length ? replacedCodes : undefined },
    });
    return this.payload(card);
  }

  /** Release a member's active card back to the pool (or retire a digital token). */
  async unassign(memberId: string, actor: Actor): Promise<void> {
    const card = await this.tokenModel
      .findOne({ member: memberId, isActive: true })
      .sort({ updatedAt: -1 })
      .exec();
    if (!card) throw new NotFoundException('This member has no active card to release.');

    if (card.cardCode) {
      card.member = null;
      card.isActive = false;
      card.status = 'UNASSIGNED';
      card.revokedAt = null;
      await card.save();
    } else {
      card.isActive = false;
      card.revokedAt = new Date();
      await card.save();
    }
    await this.membersService.setQrEnabled(memberId, false);
    await this.auditLogsService.record({
      action: AuditAction.QR_UNASSIGNED,
      entityType: 'MemberProfile',
      entityId: new Types.ObjectId(memberId),
      actor,
      metadata: { cardCode: card.cardCode ?? null },
    });
  }

  /* ───────────────────────── Scan-side ───────────────────────── */

  /**
   * Resolve a scanned QR / typed code to a member id. Identity only — the
   * attendance service decides whether that member may actually enter.
   */
  async resolveToken(input: string): Promise<Types.ObjectId | null> {
    const raw = input.startsWith('IRONGYM:') ? input.slice(8) : input.trim();
    if (!raw) return null;

    // Primary: the opaque token encoded in the QR image.
    let doc = await this.tokenModel
      .findOne({ tokenHash: sha256(raw), isActive: true, member: { $ne: null } })
      .exec();

    // Fallback: the printed card code, e.g. "A7K2P9QX".
    if (!doc && /^[a-z0-9]{8}$/i.test(raw)) {
      doc = await this.tokenModel
        .findOne({ cardCode: raw.toUpperCase(), isActive: true, member: { $ne: null } })
        .exec();
    }

    // Fallback: the member code, e.g. "IRON-7K2Q9F".
    if (!doc && /^[a-z]{2,}-[a-z0-9]{3,}$/i.test(raw)) {
      const memberId = await this.membersService.findIdByMemberCode(raw);
      if (memberId) {
        doc = await this.tokenModel
          .findOne({ member: memberId, isActive: true })
          .exec();
      }
    }

    if (!doc) return null;
    doc.lastUsedAt = new Date();
    await doc.save();
    return doc.member;
  }
}
