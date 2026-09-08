import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientSession, Connection, FilterQuery, Model, Types } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { NotificationType, SubscriptionStatus } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { MembersService } from '../members/members.service';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { SubscriptionQueryDto } from './dto/subscription.dto';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  DAY_MS,
} from './subscriptions.constants';
import { resolveSubscription, ResolvedSubscription } from './subscription-status.util';

interface CreateArgs {
  memberId: string;
  planId: string;
  branchId?: string;
  discountAmount?: number;
  createdBy?: string;
  selfServe?: boolean;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly expiringSoonDays: number;

  constructor(
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly plansService: SubscriptionPlansService,
    private readonly membersService: MembersService,
    private readonly notificationsService: NotificationsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.expiringSoonDays = config.get('business.expiringSoonThresholdDays', { infer: true });
  }

  resolve(sub: SubscriptionDocument, now?: Date): ResolvedSubscription {
    return resolveSubscription(sub, this.expiringSoonDays, now);
  }

  /** Plain object for API responses, with the derived status merged in. */
  view(sub: SubscriptionDocument) {
    const resolved = this.resolve(sub);
    const json = sub.toJSON() as Record<string, unknown>;
    return {
      ...json,
      effectiveStatus: resolved.status,
      daysRemaining: resolved.daysRemaining,
      isUsable: resolved.isUsable,
    };
  }

  // ─────────────────────────── Creation ───────────────────────────

  async create(args: CreateArgs): Promise<SubscriptionDocument> {
    const member = await this.membersService.findRawById(args.memberId);
    if (!member) throw new NotFoundException('Member not found');

    const plan = await this.plansService.getActiveByIdOrFail(args.planId);

    const blocking = await this.subModel
      .findOne({ member: member._id, status: { $in: BLOCKING_SUBSCRIPTION_STATUSES } })
      .sort({ createdAt: -1 })
      .exec();
    if (blocking) {
      throw new BadRequestException(
        'This member already has a pending or active subscription. Cancel or complete it first.',
      );
    }

    const discount = Math.min(args.discountAmount ?? 0, plan.price);
    const finalPrice = Math.max(0, plan.price - discount);

    const lastEnded = await this.subModel
      .findOne({ member: member._id, status: SubscriptionStatus.CANCELLED })
      .sort({ createdAt: -1 })
      .select('_id')
      .exec();

    const [sub] = await this.subModel.create([
      {
        member: member._id,
        plan: plan._id,
        branch: args.branchId
          ? new Types.ObjectId(args.branchId)
          : member.primaryBranch ?? null,
        planNameAr: plan.nameAr,
        planNameEn: plan.nameEn,
        durationDays: plan.durationDays,
        allowedVisits: plan.allowedVisits,
        planFreezeDays: plan.freezeDays,
        basePrice: plan.price,
        discountAmount: discount,
        finalPrice,
        paidAmount: 0,
        remainingAmount: finalPrice,
        status: SubscriptionStatus.PENDING_PAYMENT,
        createdBy: args.createdBy ? new Types.ObjectId(args.createdBy) : null,
        selfServe: args.selfServe ?? false,
        renewedFrom: lastEnded?._id ?? null,
      },
    ]);

    await this.membersService.setCurrentSubscription(member._id, sub._id);
    try {
      await this.notificationsService.emit({
        userId: (member.user as { _id?: Types.ObjectId })?._id ?? member.user,
        type: NotificationType.SUBSCRIPTION_CREATED,
        vars: { plan: plan.nameEn },
        metadata: { subscriptionId: String(sub._id) },
      });
    } catch (err) {
      this.logger.warn(`SUBSCRIPTION_CREATED notification failed: ${(err as Error).message}`);
    }
    return sub;
  }

  // ─────────────────────── Payment-driven transitions ───────────────────────

  /** Called by the payments module when a proof is submitted. */
  async markUnderReview(
    subscriptionId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<void> {
    await this.subModel
      .updateOne(
        { _id: subscriptionId, status: SubscriptionStatus.PENDING_PAYMENT },
        { $set: { status: SubscriptionStatus.PAYMENT_UNDER_REVIEW } },
        { session },
      )
      .exec();
  }

  /** Called when a payment is rejected / cancelled and nothing else is pending. */
  async revertToPending(
    subscriptionId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<void> {
    await this.subModel
      .updateOne(
        { _id: subscriptionId, status: SubscriptionStatus.PAYMENT_UNDER_REVIEW },
        { $set: { status: SubscriptionStatus.PENDING_PAYMENT } },
        { session },
      )
      .exec();
  }

  /**
   * Apply an approved payment amount. Activates the subscription once the
   * balance is cleared. Runs inside the caller's transaction.
   */
  async applyApprovedPayment(
    subscriptionId: Types.ObjectId | string,
    amount: number,
    session: ClientSession,
  ): Promise<{ subscription: SubscriptionDocument; activated: boolean }> {
    const sub = await this.subModel.findById(subscriptionId).session(session).exec();
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is cancelled');
    }

    sub.paidAmount = Math.round((sub.paidAmount + amount) * 100) / 100;
    sub.remainingAmount = Math.max(0, Math.round((sub.finalPrice - sub.paidAmount) * 100) / 100);

    let activated = false;
    const notYetActive =
      sub.status === SubscriptionStatus.PENDING_PAYMENT ||
      sub.status === SubscriptionStatus.PAYMENT_UNDER_REVIEW;

    if (sub.remainingAmount <= 0 && notYetActive) {
      const start = new Date();
      sub.startDate = start;
      sub.endDate = new Date(start.getTime() + sub.durationDays * DAY_MS);
      sub.status = SubscriptionStatus.ACTIVE;
      sub.activatedAt = start;
      activated = true;
    } else if (notYetActive) {
      // Partial payment recorded but balance remains — keep it visible for review.
      sub.status = SubscriptionStatus.PAYMENT_UNDER_REVIEW;
    }

    await sub.save({ session });
    if (activated) {
      await this.membersService.setCurrentSubscription(sub.member, sub._id, session);
    }
    return { subscription: sub, activated };
  }

  // ─────────────────────────── Freeze support ───────────────────────────

  async applyFreeze(
    subscriptionId: Types.ObjectId | string,
    days: number,
    session?: ClientSession,
  ): Promise<SubscriptionDocument> {
    const sub = await this.subModel.findById(subscriptionId).session(session ?? null).exec();
    if (!sub) throw new NotFoundException('Subscription not found');
    if (!sub.endDate) throw new BadRequestException('Subscription is not active yet');

    const remainingFreeze = sub.planFreezeDays - sub.freezeDaysUsed;
    if (days > remainingFreeze) {
      throw new BadRequestException(
        `Only ${remainingFreeze} freeze day(s) remain on this subscription`,
      );
    }

    sub.endDate = new Date(sub.endDate.getTime() + days * DAY_MS);
    sub.freezeDaysUsed += days;
    sub.status = SubscriptionStatus.FROZEN;
    sub.frozenAt = new Date();
    await sub.save({ session });
    return sub;
  }

  async endFreeze(
    subscriptionId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<SubscriptionDocument> {
    const sub = await this.subModel.findById(subscriptionId).session(session ?? null).exec();
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== SubscriptionStatus.FROZEN) return sub;
    sub.status = SubscriptionStatus.ACTIVE;
    sub.frozenAt = null;
    await sub.save({ session });
    return sub;
  }

  // ─────────────────────────── Cancellation ───────────────────────────

  async cancel(
    subscriptionId: string | Types.ObjectId,
    reason: string,
    actorUserId: string,
  ): Promise<SubscriptionDocument> {
    const sub = await this.subModel.findById(subscriptionId).exec();
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }
    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    sub.cancelledBy = new Types.ObjectId(actorUserId);
    sub.cancellationReason = reason;
    await sub.save();

    const member = await this.membersService.findRawById(sub.member);
    if (member && String(member.currentSubscription) === String(sub._id)) {
      await this.membersService.setCurrentSubscription(sub.member, null);
    }
    return sub;
  }

  // ─────────────────────────── Reads ───────────────────────────

  async getByIdOrFail(id: string | Types.ObjectId): Promise<SubscriptionDocument> {
    const sub = await this.subModel
      .findById(id)
      .populate('plan', 'nameAr nameEn price durationDays')
      .populate('branch', 'code nameAr nameEn')
      .exec();
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  findRawById(id: string | Types.ObjectId): Promise<SubscriptionDocument | null> {
    return this.subModel.findById(id).exec();
  }

  async currentForMember(memberId: string | Types.ObjectId): Promise<SubscriptionDocument | null> {
    return this.subModel
      .findOne({ member: memberId, status: { $ne: SubscriptionStatus.CANCELLED } })
      .sort({ createdAt: -1 })
      .populate('plan', 'nameAr nameEn price durationDays allowedVisits')
      .exec();
  }

  historyForMember(memberId: string | Types.ObjectId): Promise<SubscriptionDocument[]> {
    return this.subModel
      .find({ member: memberId })
      .sort({ createdAt: -1 })
      .populate('plan', 'nameAr nameEn price')
      .exec();
  }

  async list(query: SubscriptionQueryDto): Promise<PaginatedResult<SubscriptionDocument>> {
    const filter: FilterQuery<SubscriptionDocument> = {};
    if (query.memberId) filter.member = new Types.ObjectId(query.memberId);
    if (query.planId) filter.plan = new Types.ObjectId(query.planId);
    if (query.branchId) filter.branch = new Types.ObjectId(query.branchId);
    if (query.status) filter.status = query.status as SubscriptionStatus;

    const [items, total] = await Promise.all([
      this.subModel
        .find(filter)
        .populate({
          path: 'member',
          select: 'memberCode user',
          populate: { path: 'user', select: 'firstName lastName phone' },
        })
        .populate('plan', 'nameAr nameEn price')
        .sort(buildSort(query.sortBy, query.sortDir))
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.subModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async incrementVisit(
    subscriptionId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<void> {
    await this.subModel
      .updateOne({ _id: subscriptionId }, { $inc: { visitsUsed: 1 } }, { session })
      .exec();
  }

  // ─────────────────────────── Scheduled maintenance ───────────────────────────

  /**
   * Hourly: emit one-shot EXPIRING / EXPIRED notifications. EXPIRED status itself
   * stays derived (see resolveSubscription); we only persist the notified flags.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpirations(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + this.expiringSoonDays * DAY_MS);

    const populate = { path: 'member', select: 'user' } as const;
    type WithUser = SubscriptionDocument & { member: { user: Types.ObjectId } };

    const expiring = (await this.subModel
      .find({
        status: SubscriptionStatus.ACTIVE,
        endDate: { $gt: now, $lte: soon },
        expiringNotifiedAt: null,
      })
      .populate(populate)
      .exec()) as unknown as WithUser[];

    for (const sub of expiring) {
      const resolved = this.resolve(sub, now);
      await this.notificationsService.emit({
        userId: sub.member.user,
        type: NotificationType.SUBSCRIPTION_EXPIRING,
        vars: {
          days: resolved.daysRemaining,
          endDate: sub.endDate ? sub.endDate.toISOString().slice(0, 10) : '',
        },
        metadata: { subscriptionId: String(sub._id) },
      });
      sub.expiringNotifiedAt = now;
      await sub.save();
    }

    const expired = (await this.subModel
      .find({
        status: SubscriptionStatus.ACTIVE,
        endDate: { $lte: now },
        expiredNotifiedAt: null,
      })
      .populate(populate)
      .exec()) as unknown as WithUser[];

    for (const sub of expired) {
      await this.notificationsService.emit({
        userId: sub.member.user,
        type: NotificationType.SUBSCRIPTION_EXPIRED,
        vars: { endDate: sub.endDate ? sub.endDate.toISOString().slice(0, 10) : '' },
        metadata: { subscriptionId: String(sub._id) },
      });
      sub.expiredNotifiedAt = now;
      await sub.save();
    }

    if (expiring.length || expired.length) {
      this.logger.log(
        `Lifecycle sweep: ${expiring.length} expiring, ${expired.length} expired notified`,
      );
    }
  }
}
