import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import {
  AccessDecision,
  AttendanceSource,
  AuditAction,
  SubscriptionStatus,
} from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { paginated } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MembersService } from '../members/members.service';
import { QrAccessService } from '../qr-access/qr-access.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AttendanceQueryDto } from './dto/attendance.dto';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';

interface ScanArgs {
  rawToken?: string;
  memberProfileId?: string;
  branchId?: string;
  source: AttendanceSource;
  staffUserId: string;
}

export interface AccessResult {
  decision: AccessDecision;
  approved: boolean;
  message: string;
  member: {
    id: string;
    name: string;
    memberCode: string;
    image: string | null;
    phone: string;
    dailyCheckInLimit: number;
    todayCheckIns: number;
  } | null;
  subscription: {
    planNameEn: string;
    planNameAr: string;
    status: SubscriptionStatus;
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    remainingAmount: number;
    visitsUsed: number;
    allowedVisits: number;
    freezeDaysUsed: number;
    planFreezeDays: number;
  } | null;
  lastVisitAt: Date | null;
  totalApprovedVisits: number;
  attendanceId: string | null;
  checkInAt: Date | null;
}

const DENY_MESSAGES: Record<AccessDecision, string> = {
  [AccessDecision.APPROVED]: 'Welcome',
  [AccessDecision.DENIED_INVALID]: 'QR code not recognized',
  [AccessDecision.DENIED_EXPIRED]: 'Membership has expired',
  [AccessDecision.DENIED_FROZEN]: 'Membership is currently frozen',
  [AccessDecision.DENIED_NO_MEMBERSHIP]: 'No active membership',
  [AccessDecision.DENIED_PENDING_PAYMENT]: 'Payment pending / under review',
  [AccessDecision.DENIED_DAILY_LIMIT]: "Daily check-in limit reached",
  [AccessDecision.DENIED_BANNED]: 'This member is banned',
  [AccessDecision.ALREADY_CHECKED_IN]: 'Already checked in',
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AttendanceService {
  private readonly duplicateWindowMs: number;

  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    private readonly membersService: MembersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly qrAccessService: QrAccessService,
    private readonly auditLogsService: AuditLogsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.duplicateWindowMs =
      config.get('business.duplicateCheckinWindowSeconds', { infer: true }) * 1000;
  }

  async processScan(args: ScanArgs): Promise<AccessResult> {
    const now = new Date();
    const branch = args.branchId ? new Types.ObjectId(args.branchId) : null;

    // 1. Resolve the member.
    let memberProfileId: Types.ObjectId | null = null;
    if (args.rawToken) {
      memberProfileId = await this.qrAccessService.resolveToken(args.rawToken);
    } else if (args.memberProfileId) {
      memberProfileId = new Types.ObjectId(args.memberProfileId);
    }
    if (!memberProfileId) {
      return this.empty(AccessDecision.DENIED_INVALID);
    }

    const member = await this.membersService.getByIdOrFail(memberProfileId).catch(() => null);
    if (!member) return this.empty(AccessDecision.DENIED_INVALID);

    const user = member.user as unknown as {
      firstName: string;
      lastName: string;
      phone?: string;
      isBanned?: boolean;
    };

    const [lastApproved, totalApprovedVisits, todayCheckIns] = await Promise.all([
      this.attendanceModel
        .findOne({ member: member._id, accessStatus: AccessDecision.APPROVED })
        .sort({ checkInAt: -1 })
        .lean()
        .exec(),
      this.attendanceModel
        .countDocuments({ member: member._id, accessStatus: AccessDecision.APPROVED })
        .exec(),
      this.attendanceModel
        .countDocuments({
          member: member._id,
          accessStatus: AccessDecision.APPROVED,
          checkInAt: { $gte: startOfToday() },
        })
        .exec(),
    ]);

    const memberView = {
      id: String(member._id),
      name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      memberCode: member.memberCode,
      image: member.profileImage?.secureUrl || null,
      phone: user?.phone ?? '',
      dailyCheckInLimit: member.dailyCheckInLimit ?? 0,
      todayCheckIns,
    };

    // 1b. Banned members never enter, regardless of membership state.
    if (user?.isBanned) {
      return this.deny(
        AccessDecision.DENIED_BANNED,
        memberView,
        null,
        lastApproved?.checkInAt ?? null,
        totalApprovedVisits,
        args,
        member._id,
        branch,
        now,
      );
    }

    // 2. Membership checks.
    const sub = await this.subscriptionsService.currentForMember(member._id);
    if (!sub) {
      return this.deny(
        AccessDecision.DENIED_NO_MEMBERSHIP,
        memberView,
        null,
        lastApproved?.checkInAt ?? null,
        totalApprovedVisits,
        args,
        member._id,
        branch,
        now,
      );
    }

    const resolved = this.subscriptionsService.resolve(sub, now);
    const subView = {
      planNameEn: sub.planNameEn,
      planNameAr: sub.planNameAr,
      status: resolved.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining: resolved.daysRemaining,
      remainingAmount: sub.remainingAmount,
      visitsUsed: sub.visitsUsed,
      allowedVisits: sub.allowedVisits,
      freezeDaysUsed: sub.freezeDaysUsed,
      planFreezeDays: sub.planFreezeDays,
    };

    let decision: AccessDecision;
    switch (resolved.status) {
      case SubscriptionStatus.FROZEN:
        decision = AccessDecision.DENIED_FROZEN;
        break;
      case SubscriptionStatus.PENDING_PAYMENT:
      case SubscriptionStatus.PAYMENT_UNDER_REVIEW:
        decision = AccessDecision.DENIED_PENDING_PAYMENT;
        break;
      case SubscriptionStatus.EXPIRED:
        decision = AccessDecision.DENIED_EXPIRED;
        break;
      case SubscriptionStatus.CANCELLED:
        decision = AccessDecision.DENIED_NO_MEMBERSHIP;
        break;
      default:
        decision = AccessDecision.APPROVED;
    }

    if (decision !== AccessDecision.APPROVED) {
      return this.deny(
        decision,
        memberView,
        subView,
        lastApproved?.checkInAt ?? null,
        totalApprovedVisits,
        args,
        member._id,
        branch,
        now,
        sub._id,
      );
    }

    // 3a. Per-member daily check-in cap.
    if (member.dailyCheckInLimit > 0 && todayCheckIns >= member.dailyCheckInLimit) {
      return this.deny(
        AccessDecision.DENIED_DAILY_LIMIT,
        memberView,
        subView,
        lastApproved?.checkInAt ?? null,
        totalApprovedVisits,
        args,
        member._id,
        branch,
        now,
        sub._id,
      );
    }

    // 3b. Duplicate guard.
    if (
      lastApproved &&
      now.getTime() - new Date(lastApproved.checkInAt).getTime() < this.duplicateWindowMs
    ) {
      return {
        decision: AccessDecision.ALREADY_CHECKED_IN,
        approved: false,
        message: DENY_MESSAGES[AccessDecision.ALREADY_CHECKED_IN],
        member: memberView,
        subscription: subView,
        lastVisitAt: lastApproved.checkInAt,
        totalApprovedVisits,
        attendanceId: String(lastApproved._id),
        checkInAt: lastApproved.checkInAt,
      };
    }

    // 4. Record the visit.
    const [attendance] = await this.attendanceModel.create([
      {
        member: member._id,
        branch: branch ?? member.primaryBranch ?? null,
        subscription: sub._id,
        checkInAt: now,
        checkedInBy: new Types.ObjectId(args.staffUserId),
        source: args.source,
        accessStatus: AccessDecision.APPROVED,
      },
    ]);
    await this.subscriptionsService.incrementVisit(sub._id);
    await this.auditLogsService.record({
      action: AuditAction.ATTENDANCE_CREATED,
      entityType: 'Attendance',
      entityId: attendance._id,
      actor: { id: args.staffUserId },
      after: { member: String(member._id), decision: AccessDecision.APPROVED },
    });

    return {
      decision: AccessDecision.APPROVED,
      approved: true,
      message: DENY_MESSAGES[AccessDecision.APPROVED],
      member: memberView,
      subscription: subView,
      lastVisitAt: lastApproved?.checkInAt ?? null,
      totalApprovedVisits: totalApprovedVisits + 1,
      attendanceId: String(attendance._id),
      checkInAt: now,
    };
  }

  private empty(decision: AccessDecision): AccessResult {
    return {
      decision,
      approved: false,
      message: DENY_MESSAGES[decision],
      member: null,
      subscription: null,
      lastVisitAt: null,
      totalApprovedVisits: 0,
      attendanceId: null,
      checkInAt: null,
    };
  }

  private async deny(
    decision: AccessDecision,
    memberView: AccessResult['member'],
    subView: AccessResult['subscription'],
    lastVisitAt: Date | null,
    totalApprovedVisits: number,
    args: ScanArgs,
    memberId: Types.ObjectId,
    branch: Types.ObjectId | null,
    now: Date,
    subscriptionId?: Types.ObjectId,
  ): Promise<AccessResult> {
    const [attendance] = await this.attendanceModel.create([
      {
        member: memberId,
        branch,
        subscription: subscriptionId ?? null,
        checkInAt: now,
        checkedInBy: new Types.ObjectId(args.staffUserId),
        source: args.source,
        accessStatus: decision,
      },
    ]);
    return {
      decision,
      approved: false,
      message: DENY_MESSAGES[decision],
      member: memberView,
      subscription: subView,
      lastVisitAt,
      totalApprovedVisits,
      attendanceId: String(attendance._id),
      checkInAt: now,
    };
  }

  // ─────────────────────────── History / lists ───────────────────────────

  private rangeFilter(query: AttendanceQueryDto): { $gte?: Date; $lte?: Date } | undefined {
    const now = new Date();
    if (query.range === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { $gte: start };
    }
    if (query.range === 'week') {
      return { $gte: new Date(now.getTime() - 7 * 86_400_000) };
    }
    if (query.range === 'month') {
      return { $gte: new Date(now.getTime() - 30 * 86_400_000) };
    }
    if (query.from || query.to) {
      const r: { $gte?: Date; $lte?: Date } = {};
      if (query.from) r.$gte = new Date(query.from);
      if (query.to) r.$lte = new Date(query.to);
      return r;
    }
    return undefined;
  }

  async list(query: AttendanceQueryDto): Promise<PaginatedResult<AttendanceDocument>> {
    const filter: FilterQuery<AttendanceDocument> = {};
    const range = this.rangeFilter(query);
    if (range) filter.checkInAt = range;
    if (query.branchId) filter.branch = new Types.ObjectId(query.branchId);
    if (query.memberId) filter.member = new Types.ObjectId(query.memberId);
    if (query.accessStatus) filter.accessStatus = query.accessStatus as AccessDecision;

    const [items, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .populate({
          path: 'member',
          select: 'memberCode user',
          populate: { path: 'user', select: 'firstName lastName phone' },
        })
        .populate('branch', 'code nameEn nameAr')
        .sort({ checkInAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.attendanceModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async memberHistory(
    memberProfileId: string | Types.ObjectId,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AttendanceDocument>> {
    const filter = { member: memberProfileId, accessStatus: AccessDecision.APPROVED };
    const [items, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .populate('branch', 'code nameEn nameAr')
        .sort({ checkInAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.attendanceModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, page, limit);
  }

  countToday(): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.attendanceModel
      .countDocuments({ checkInAt: { $gte: start }, accessStatus: AccessDecision.APPROVED })
      .exec();
  }
}
