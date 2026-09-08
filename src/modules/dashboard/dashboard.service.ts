import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { MemberProfile, MemberProfileDocument } from '../members/schemas/member-profile.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../subscriptions/schemas/subscription.schema';
import { DAY_MS } from '../subscriptions/subscriptions.constants';

export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  expiringSoon: number;
  pendingPayments: number;
  paymentsUnderReview: number;
  newMembersThisMonth: number;
  todayCheckins: number;
  monthlyRevenue: number;
  outstandingBalance: number;
}

export interface ActionCenterItem {
  key: string;
  count: number;
  href: string;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfToday(d = new Date()): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

@Injectable()
export class DashboardService {
  private readonly expiringSoonDays: number;

  constructor(
    @InjectModel(MemberProfile.name) private readonly memberModel: Model<MemberProfileDocument>,
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    config: ConfigService<AppConfig, true>,
  ) {
    this.expiringSoonDays = config.get('business.expiringSoonThresholdDays', { infer: true });
  }

  async summary(): Promise<DashboardSummary> {
    const now = new Date();
    const soon = new Date(now.getTime() + this.expiringSoonDays * DAY_MS);
    const monthStart = startOfMonth(now);
    const todayStart = startOfToday(now);

    const [
      totalMembers,
      activeMembers,
      expiredMembers,
      expiringSoon,
      pendingPayments,
      paymentsUnderReview,
      newMembersThisMonth,
      todayCheckins,
      revenueAgg,
      outstandingAgg,
    ] = await Promise.all([
      this.memberModel.countDocuments().exec(),
      this.subModel
        .countDocuments({ status: SubscriptionStatus.ACTIVE, endDate: { $gt: now } })
        .exec(),
      this.subModel
        .countDocuments({ status: SubscriptionStatus.ACTIVE, endDate: { $lte: now } })
        .exec(),
      this.subModel
        .countDocuments({
          status: SubscriptionStatus.ACTIVE,
          endDate: { $gt: now, $lte: soon },
        })
        .exec(),
      this.subModel
        .countDocuments({ status: SubscriptionStatus.PENDING_PAYMENT })
        .exec(),
      this.paymentModel
        .countDocuments({
          status: { $in: [PaymentStatus.UNDER_REVIEW, PaymentStatus.PENDING] },
        })
        .exec(),
      this.memberModel.countDocuments({ createdAt: { $gte: monthStart } }).exec(),
      this.attendanceModel
        .countDocuments({ checkInAt: { $gte: todayStart }, accessStatus: 'APPROVED' })
        .exec(),
      this.paymentModel
        .aggregate<{ total: number }>([
          {
            $match: {
              status: PaymentStatus.APPROVED,
              approvedAt: { $gte: monthStart },
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .exec(),
      this.subModel
        .aggregate<{ total: number }>([
          {
            $match: {
              status: {
                $in: [
                  SubscriptionStatus.ACTIVE,
                  SubscriptionStatus.PAYMENT_UNDER_REVIEW,
                  SubscriptionStatus.PENDING_PAYMENT,
                  SubscriptionStatus.FROZEN,
                ],
              },
              remainingAmount: { $gt: 0 },
            },
          },
          { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
        ])
        .exec(),
    ]);

    return {
      totalMembers,
      activeMembers,
      expiredMembers,
      expiringSoon,
      pendingPayments,
      paymentsUnderReview,
      newMembersThisMonth,
      todayCheckins,
      monthlyRevenue: revenueAgg[0]?.total ?? 0,
      outstandingBalance: outstandingAgg[0]?.total ?? 0,
    };
  }

  async actionCenter(): Promise<ActionCenterItem[]> {
    const now = new Date();
    const soon = new Date(now.getTime() + this.expiringSoonDays * DAY_MS);

    const [underReview, expiringSoon, outstanding, refundRequests] = await Promise.all([
      this.paymentModel
        .countDocuments({ status: { $in: [PaymentStatus.UNDER_REVIEW, PaymentStatus.PENDING] } })
        .exec(),
      this.subModel
        .countDocuments({ status: SubscriptionStatus.ACTIVE, endDate: { $gt: now, $lte: soon } })
        .exec(),
      this.subModel
        .countDocuments({
          status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
          remainingAmount: { $gt: 0 },
        })
        .exec(),
      this.paymentModel.countDocuments({ status: PaymentStatus.REFUND_REQUESTED }).exec(),
    ]);

    return [
      { key: 'paymentsUnderReview', count: underReview, href: '/payments?tab=under_review' },
      { key: 'expiringSoon', count: expiringSoon, href: '/members?status=expiring_soon' },
      { key: 'outstandingBalance', count: outstanding, href: '/members?status=outstanding' },
      { key: 'refundRequests', count: refundRequests, href: '/payments?tab=refund_requested' },
    ].filter((i) => i.count > 0);
  }
}
