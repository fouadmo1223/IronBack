import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { MemberProfile, MemberProfileDocument } from '../members/schemas/member-profile.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../subscriptions/schemas/subscription.schema';
import { ReportRangeDto } from './dto/report-query.dto';

const GRANULARITY_FORMAT: Record<string, string> = {
  day: '%Y-%m-%d',
  week: '%G-W%V',
  month: '%Y-%m',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(MemberProfile.name) private readonly memberModel: Model<MemberProfileDocument>,
    @InjectModel(Subscription.name) private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  private range(dto: ReportRangeDto): { from: Date; to: Date; fmt: string } {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getFullYear(), to.getMonth() - 11, 1);
    return { from, to, fmt: GRANULARITY_FORMAT[dto.granularity ?? 'month'] };
  }

  async membershipGrowth(dto: ReportRangeDto) {
    const { from, to, fmt } = this.range(dto);
    const stages: PipelineStage[] = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: fmt, date: '$createdAt' } },
          newMembers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', newMembers: 1 } },
    ];
    return this.memberModel.aggregate(stages).exec();
  }

  async revenueTrend(dto: ReportRangeDto) {
    const { from, to, fmt } = this.range(dto);
    return this.paymentModel
      .aggregate([
        { $match: { status: PaymentStatus.APPROVED, approvedAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: fmt, date: '$approvedAt' } },
            revenue: { $sum: '$amount' },
            payments: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, period: '$_id', revenue: 1, payments: 1 } },
      ])
      .exec();
  }

  async revenueByMethod(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    return this.paymentModel
      .aggregate([
        { $match: { status: PaymentStatus.APPROVED, approvedAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$paymentMethodLabel',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, method: '$_id', revenue: 1, count: 1 } },
      ])
      .exec();
  }

  async revenueByPlan(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    return this.paymentModel
      .aggregate([
        { $match: { status: PaymentStatus.APPROVED, approvedAt: { $gte: from, $lte: to } } },
        {
          $lookup: {
            from: 'subscriptions',
            localField: 'subscription',
            foreignField: '_id',
            as: 'sub',
          },
        },
        { $unwind: '$sub' },
        {
          $group: {
            _id: '$sub.planNameEn',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, plan: '$_id', revenue: 1, count: 1 } },
      ])
      .exec();
  }

  async paymentOutcomes(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    return this.paymentModel
      .aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, status: '$_id', count: 1, amount: 1 } },
      ])
      .exec();
  }

  async subscriptionsByPlan() {
    return this.subModel
      .aggregate([
        { $group: { _id: '$planNameEn', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, plan: '$_id', count: 1 } },
      ])
      .exec();
  }

  async subscriptionStatusBreakdown() {
    return this.subModel
      .aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ])
      .exec();
  }

  async renewalRate(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    const [total, renewals] = await Promise.all([
      this.subModel.countDocuments({ createdAt: { $gte: from, $lte: to } }).exec(),
      this.subModel
        .countDocuments({ createdAt: { $gte: from, $lte: to }, renewedFrom: { $ne: null } })
        .exec(),
    ]);
    return { total, renewals, rate: total ? Math.round((renewals / total) * 1000) / 10 : 0 };
  }

  async attendanceTrend(dto: ReportRangeDto) {
    const { from, to, fmt } = this.range(dto);
    return this.attendanceModel
      .aggregate([
        { $match: { accessStatus: 'APPROVED', checkInAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: fmt, date: '$checkInAt' } },
            visits: { $sum: 1 },
            uniqueMembers: { $addToSet: '$member' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            period: '$_id',
            visits: 1,
            uniqueMembers: { $size: '$uniqueMembers' },
          },
        },
      ])
      .exec();
  }

  async peakHours(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    return this.attendanceModel
      .aggregate([
        { $match: { accessStatus: 'APPROVED', checkInAt: { $gte: from, $lte: to } } },
        { $group: { _id: { $hour: '$checkInAt' }, visits: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: '$_id', visits: 1 } },
      ])
      .exec();
  }

  async mostActiveMembers(dto: ReportRangeDto) {
    const { from, to } = this.range(dto);
    return this.attendanceModel
      .aggregate([
        { $match: { accessStatus: 'APPROVED', checkInAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$member', visits: { $sum: 1 } } },
        { $sort: { visits: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'member_profiles',
            localField: '_id',
            foreignField: '_id',
            as: 'member',
          },
        },
        { $unwind: '$member' },
        {
          $lookup: {
            from: 'users',
            localField: 'member.user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            memberId: '$_id',
            memberCode: '$member.memberCode',
            name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
            visits: 1,
          },
        },
      ])
      .exec();
  }

  async inactiveMembers(days = 30) {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const activeIds = await this.attendanceModel.distinct('member', {
      accessStatus: 'APPROVED',
      checkInAt: { $gte: cutoff },
    });
    const count = await this.memberModel.countDocuments({ _id: { $nin: activeIds } }).exec();
    return { inactiveSinceDays: days, count };
  }

  async outstandingBalances() {
    return this.subModel
      .aggregate([
        {
          $match: {
            status: {
              $in: [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.FROZEN,
                SubscriptionStatus.PAYMENT_UNDER_REVIEW,
              ],
            },
            remainingAmount: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: 'member_profiles',
            localField: 'member',
            foreignField: '_id',
            as: 'member',
          },
        },
        { $unwind: '$member' },
        {
          $lookup: {
            from: 'users',
            localField: 'member.user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            subscriptionId: '$_id',
            memberCode: '$member.memberCode',
            name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
            phone: '$user.phone',
            planNameEn: 1,
            remainingAmount: 1,
          },
        },
        { $sort: { remainingAmount: -1 } },
      ])
      .exec();
  }
}
