import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilterQuery, Model, Types } from 'mongoose';
import { SubscriptionFreezeStatus, SubscriptionStatus } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { DAY_MS } from '../subscriptions/subscriptions.constants';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FreezeQueryDto, RequestFreezeDto } from './dto/subscription-freeze.dto';
import {
  SubscriptionFreeze,
  SubscriptionFreezeDocument,
} from './schemas/subscription-freeze.schema';

@Injectable()
export class SubscriptionFreezesService {
  private readonly logger = new Logger(SubscriptionFreezesService.name);

  constructor(
    @InjectModel(SubscriptionFreeze.name)
    private readonly freezeModel: Model<SubscriptionFreezeDocument>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async request(
    dto: RequestFreezeDto,
    requestedByUserId: string,
    opts: { memberId?: string; enforceMemberId?: string } = {},
  ): Promise<SubscriptionFreezeDocument> {
    const sub = await this.subscriptionsService.findRawById(dto.subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');
    if (opts.enforceMemberId && String(sub.member) !== opts.enforceMemberId) {
      throw new ForbiddenException('This subscription does not belong to you');
    }
    if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING_SOON].includes(sub.status)) {
      throw new BadRequestException('Only an active subscription can be frozen');
    }

    const remaining = sub.planFreezeDays - sub.freezeDaysUsed;
    if (dto.numberOfDays > remaining) {
      throw new BadRequestException(`Only ${remaining} freeze day(s) remain on this subscription`);
    }

    const pending = await this.freezeModel.exists({
      subscription: sub._id,
      status: SubscriptionFreezeStatus.PENDING,
    });
    if (pending) throw new BadRequestException('A freeze request is already pending for review');

    const start = new Date(dto.startDate);
    const end = new Date(start.getTime() + dto.numberOfDays * DAY_MS);

    return this.freezeModel.create({
      subscription: sub._id,
      member: sub.member,
      startDate: start,
      endDate: end,
      numberOfDays: dto.numberOfDays,
      reason: dto.reason ?? '',
      requestedBy: new Types.ObjectId(requestedByUserId),
      status: SubscriptionFreezeStatus.PENDING,
    });
  }

  async approve(id: string, approverUserId: string, note?: string): Promise<SubscriptionFreezeDocument> {
    const freeze = await this.getPendingOrFail(id);
    await this.subscriptionsService.applyFreeze(freeze.subscription, freeze.numberOfDays);
    freeze.status = SubscriptionFreezeStatus.APPROVED;
    freeze.approvedBy = new Types.ObjectId(approverUserId);
    freeze.approvedAt = new Date();
    freeze.decisionNote = note ?? '';
    await freeze.save();
    return freeze;
  }

  async reject(id: string, approverUserId: string, note?: string): Promise<SubscriptionFreezeDocument> {
    const freeze = await this.getPendingOrFail(id);
    freeze.status = SubscriptionFreezeStatus.REJECTED;
    freeze.approvedBy = new Types.ObjectId(approverUserId);
    freeze.approvedAt = new Date();
    freeze.decisionNote = note ?? '';
    await freeze.save();
    return freeze;
  }

  async cancel(id: string, enforceMemberId?: string): Promise<SubscriptionFreezeDocument> {
    const freeze = await this.freezeModel.findById(id).exec();
    if (!freeze) throw new NotFoundException('Freeze request not found');
    if (enforceMemberId && String(freeze.member) !== enforceMemberId) {
      throw new ForbiddenException('This request does not belong to you');
    }
    if (freeze.status !== SubscriptionFreezeStatus.PENDING) {
      throw new BadRequestException('Only a pending request can be cancelled');
    }
    freeze.status = SubscriptionFreezeStatus.CANCELLED;
    await freeze.save();
    return freeze;
  }

  private async getPendingOrFail(id: string): Promise<SubscriptionFreezeDocument> {
    const freeze = await this.freezeModel.findById(id).exec();
    if (!freeze) throw new NotFoundException('Freeze request not found');
    if (freeze.status !== SubscriptionFreezeStatus.PENDING) {
      throw new BadRequestException(`Request is already ${freeze.status.toLowerCase()}`);
    }
    return freeze;
  }

  listForMember(memberId: string | Types.ObjectId): Promise<SubscriptionFreezeDocument[]> {
    return this.freezeModel.find({ member: memberId }).sort({ createdAt: -1 }).exec();
  }

  async list(query: FreezeQueryDto): Promise<PaginatedResult<SubscriptionFreezeDocument>> {
    const filter: FilterQuery<SubscriptionFreezeDocument> = {};
    if (query.status) filter.status = query.status as SubscriptionFreezeStatus;
    if (query.memberId) filter.member = new Types.ObjectId(query.memberId);

    const [items, total] = await Promise.all([
      this.freezeModel
        .find(filter)
        .populate({
          path: 'member',
          select: 'memberCode user',
          populate: { path: 'user', select: 'firstName lastName phone' },
        })
        .sort(buildSort(query.sortBy, query.sortDir))
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.freezeModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  /** Nightly: reactivate subscriptions whose approved freeze window has ended. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async releaseElapsedFreezes(): Promise<void> {
    const due = await this.freezeModel
      .find({
        status: SubscriptionFreezeStatus.APPROVED,
        released: false,
        endDate: { $lte: new Date() },
      })
      .exec();

    for (const freeze of due) {
      try {
        await this.subscriptionsService.endFreeze(freeze.subscription);
        freeze.released = true;
        await freeze.save();
      } catch (err) {
        this.logger.error(`Failed to release freeze ${String(freeze._id)}`, err as Error);
      }
    }
    if (due.length) this.logger.log(`Released ${due.length} elapsed freeze(s)`);
  }
}
