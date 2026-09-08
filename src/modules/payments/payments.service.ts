import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import {
  AuditAction,
  NotificationType,
  PaymentStatus,
  SubscriptionStatus,
} from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { SequenceService } from '../../database/sequence.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MediaService, UploadFile } from '../media/media.service';
import { MediaFolder } from '../../common/enums';
import { MembersService } from '../members/members.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { QrAccessService } from '../qr-access/qr-access.service';
import {
  AdminNoteDto,
  PaymentQueryDto,
  RecordManualPaymentDto,
  RefundPaymentDto,
  RejectPaymentDto,
  SubmitPaymentDto,
} from './dto/payment.dto';
import { PaymentMethodsService } from './payment-methods.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';

interface Actor {
  id: string;
  label?: string;
  ip?: string;
  userAgent?: string;
}

const OPEN_STATUSES = [PaymentStatus.UNDER_REVIEW, PaymentStatus.PENDING];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly membersService: MembersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly qrAccessService: QrAccessService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly sequence: SequenceService,
  ) {}

  // ─────────────────────────── Member: submit proof ───────────────────────────

  async submitProof(
    memberUserId: string,
    dto: SubmitPaymentDto,
    proof: UploadFile,
    actor: Actor,
  ): Promise<PaymentDocument> {
    if (!proof) throw new BadRequestException('Payment proof image is required');

    const member = await this.membersService.getByUserIdOrFail(memberUserId);
    const subscription = await this.subscriptionsService.findRawById(dto.subscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (String(subscription.member) !== String(member._id)) {
      throw new ForbiddenException('This subscription does not belong to you');
    }
    const awaitingPayment: SubscriptionStatus[] = [
      SubscriptionStatus.PENDING_PAYMENT,
      SubscriptionStatus.PAYMENT_UNDER_REVIEW,
    ];
    if (!awaitingPayment.includes(subscription.status)) {
      throw new BadRequestException('This subscription is not awaiting payment');
    }

    const method = await this.paymentMethodsService.getActiveByIdOrFail(dto.paymentMethodId);
    const expectedAmount =
      subscription.remainingAmount > 0 ? subscription.remainingAmount : subscription.finalPrice;

    const uploaded = await this.mediaService.uploadPrivate(
      proof,
      MediaFolder.PAYMENT_PROOFS,
      String(member._id),
    );

    const payment = await this.paymentModel.create({
      member: member._id,
      subscription: subscription._id,
      paymentMethod: method._id,
      paymentMethodLabel: method.nameEn,
      amount: dto.amount,
      expectedAmount,
      senderName: dto.senderName,
      senderPhone: dto.senderPhone,
      transferDate: new Date(dto.transferDate),
      transactionReference: dto.transactionReference ?? '',
      proofImagePublicId: uploaded.publicId,
      proofImageUrl: uploaded.secureUrl,
      memberNotes: dto.memberNotes ?? '',
      status: PaymentStatus.UNDER_REVIEW,
      createdBy: new Types.ObjectId(actor.id),
    });

    await this.subscriptionsService.markUnderReview(subscription._id);
    await this.notificationsService.emit({
      userId: member.user,
      type: NotificationType.PAYMENT_SUBMITTED,
      vars: { amount: dto.amount },
      metadata: { paymentId: String(payment._id) },
    });
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_SUBMITTED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      after: { amount: dto.amount, subscription: String(subscription._id) },
    });
    return payment;
  }

  // ─────────────────────── Staff: record a received payment ───────────────────────

  async recordManual(dto: RecordManualPaymentDto, actor: Actor): Promise<PaymentDocument> {
    const subscription = await this.subscriptionsService.findRawById(dto.subscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found');

    const method = dto.paymentMethodId
      ? await this.paymentMethodsService.getByIdOrFail(dto.paymentMethodId)
      : null;

    const payment = await this.paymentModel.create({
      member: subscription.member,
      subscription: subscription._id,
      paymentMethod: method?._id ?? null,
      paymentMethodLabel: method?.nameEn ?? 'Manual entry',
      amount: dto.amount,
      expectedAmount:
        subscription.remainingAmount > 0 ? subscription.remainingAmount : subscription.finalPrice,
      transactionReference: dto.transactionReference ?? '',
      adminNotes: dto.adminNotes ?? '',
      status: PaymentStatus.UNDER_REVIEW,
      recordedManually: true,
      createdBy: new Types.ObjectId(actor.id),
    });
    await this.subscriptionsService.markUnderReview(subscription._id);
    // Staff-recorded payments are approved immediately through the standard path.
    return this.approve(String(payment._id), actor);
  }

  // ─────────────────────────── Review actions ───────────────────────────

  async approve(paymentId: string, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getOpenOrFail(paymentId);
    const year = new Date().getFullYear();
    const receiptNumber = await this.sequence.formatted(`receipt_${year}`, 6, `RCPT-${year}-`);

    const session = await this.connection.startSession();
    let activated = false;
    let subEndDate: Date | null = null;
    let subPlanName = '';
    try {
      await session.withTransaction(async () => {
        payment.status = PaymentStatus.APPROVED;
        payment.reviewedBy = new Types.ObjectId(actor.id);
        payment.reviewedAt = new Date();
        payment.approvedAt = new Date();
        payment.receiptNumber = receiptNumber;
        await payment.save({ session });

        const result = await this.subscriptionsService.applyApprovedPayment(
          payment.subscription,
          payment.amount,
          session,
        );
        activated = result.activated;
        subEndDate = result.subscription.endDate;
        subPlanName = result.subscription.planNameEn;
      });
    } finally {
      await session.endSession();
    }

    const member = await this.membersService.getByIdOrFail(payment.member);
    await this.notificationsService.emit({
      userId: member.user,
      type: NotificationType.PAYMENT_APPROVED,
      vars: { amount: payment.amount, receipt: receiptNumber },
      metadata: { paymentId },
    });
    if (activated) {
      const endDateStr = subEndDate ? new Date(subEndDate).toISOString().slice(0, 10) : '';
      await this.notificationsService.emit({
        userId: member.user,
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        vars: { plan: subPlanName, endDate: endDateStr },
        metadata: { subscriptionId: String(payment.subscription) },
      });
      // Ensure the member has an access QR (idempotent; reused across renewals).
      try {
        await this.qrAccessService.ensureForMember(payment.member);
        await this.notificationsService.emit({
          userId: member.user,
          type: NotificationType.QR_ISSUED,
          vars: { plan: subPlanName, endDate: endDateStr },
          metadata: { subscriptionId: String(payment.subscription) },
        });
      } catch (err) {
        this.logger.error(
          `Failed to issue access QR for subscription ${String(payment.subscription)}`,
          err as Error,
        );
      }
    }
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_APPROVED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      after: { receiptNumber, amount: payment.amount, activatedSubscription: activated },
    });
    return payment;
  }

  async reject(paymentId: string, dto: RejectPaymentDto, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getOpenOrFail(paymentId);
    payment.status = PaymentStatus.REJECTED;
    payment.rejectionReason = dto.reason;
    payment.reviewedBy = new Types.ObjectId(actor.id);
    payment.reviewedAt = new Date();
    payment.rejectedAt = new Date();
    await payment.save();

    await this.maybeRevertSubscription(payment);

    const member = await this.membersService.getByIdOrFail(payment.member);
    await this.notificationsService.emit({
      userId: member.user,
      type: NotificationType.PAYMENT_REJECTED,
      vars: { reason: dto.reason },
      metadata: { paymentId },
    });
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_REJECTED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      after: { reason: dto.reason },
    });
    return payment;
  }

  async markFake(paymentId: string, internalReason: string, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getOpenOrFail(paymentId);
    payment.status = PaymentStatus.FAKE;
    payment.internalReason = internalReason;
    payment.reviewedBy = new Types.ObjectId(actor.id);
    payment.reviewedAt = new Date();
    await payment.save();
    await this.maybeRevertSubscription(payment);
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_MARKED_FAKE,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      metadata: { internalReason },
    });
    return payment;
  }

  async cancel(paymentId: string, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getOpenOrFail(paymentId);
    payment.status = PaymentStatus.CANCELLED;
    payment.reviewedBy = new Types.ObjectId(actor.id);
    payment.reviewedAt = new Date();
    await payment.save();
    await this.maybeRevertSubscription(payment);
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_CANCELLED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
    });
    return payment;
  }

  async requestRefund(paymentId: string, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getByIdOrFail(paymentId);
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Only an approved payment can enter refund review');
    }
    payment.status = PaymentStatus.REFUND_REQUESTED;
    await payment.save();
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_REFUNDED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      metadata: { stage: 'requested' },
    });
    return payment;
  }

  async refund(paymentId: string, dto: RefundPaymentDto, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getByIdOrFail(paymentId);
    if (![PaymentStatus.APPROVED, PaymentStatus.REFUND_REQUESTED].includes(payment.status)) {
      throw new BadRequestException('This payment cannot be refunded in its current state');
    }
    if (dto.amount > payment.amount) {
      throw new BadRequestException('Refund amount exceeds the original payment');
    }
    payment.status = PaymentStatus.REFUNDED;
    payment.refundedAt = new Date();
    payment.refund = {
      amount: dto.amount,
      date: new Date(dto.date),
      method: dto.method,
      reference: dto.reference ?? '',
      note: dto.note ?? '',
      proofPublicId: '',
      recordedBy: new Types.ObjectId(actor.id),
    };
    await payment.save();

    const member = await this.membersService.getByIdOrFail(payment.member);
    await this.notificationsService.emit({
      userId: member.user,
      type: NotificationType.PAYMENT_REFUNDED,
      vars: { amount: dto.amount, date: dto.date },
      metadata: { paymentId },
    });
    await this.auditLogsService.record({
      action: AuditAction.PAYMENT_REFUNDED,
      entityType: 'Payment',
      entityId: payment._id,
      actor,
      after: { amount: dto.amount, method: dto.method },
    });
    return payment;
  }

  async addAdminNote(paymentId: string, dto: AdminNoteDto, actor: Actor): Promise<PaymentDocument> {
    const payment = await this.getByIdOrFail(paymentId);
    const stamp = `[${new Date().toISOString()}] ${actor.label ?? actor.id}: ${dto.note}`;
    payment.adminNotes = payment.adminNotes ? `${payment.adminNotes}\n${stamp}` : stamp;
    await payment.save();
    return payment;
  }

  // ─────────────────────────── Reads ───────────────────────────

  async list(query: PaymentQueryDto): Promise<PaginatedResult<PaymentDocument>> {
    const filter: FilterQuery<PaymentDocument> = {};
    const tab = query.tab ?? 'under_review';
    const map: Record<string, PaymentStatus[] | undefined> = {
      under_review: [PaymentStatus.UNDER_REVIEW, PaymentStatus.PENDING],
      approved: [PaymentStatus.APPROVED],
      rejected: [PaymentStatus.REJECTED],
      fake: [PaymentStatus.FAKE],
      cancelled: [PaymentStatus.CANCELLED],
      refund_requested: [PaymentStatus.REFUND_REQUESTED],
      refunded: [PaymentStatus.REFUNDED],
      all: undefined,
    };
    const statuses = map[tab];
    if (statuses) filter.status = { $in: statuses };
    if (query.memberId) filter.member = new Types.ObjectId(query.memberId);
    if (query.subscriptionId) filter.subscription = new Types.ObjectId(query.subscriptionId);

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate({
          path: 'member',
          select: 'memberCode user',
          populate: { path: 'user', select: 'firstName lastName phone' },
        })
        .populate('subscription', 'planNameEn planNameAr finalPrice remainingAmount status')
        .sort(buildSort(query.sortBy, query.sortDir))
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getDetail(id: string) {
    const payment = await this.paymentModel
      .findById(id)
      .populate({
        path: 'member',
        select: 'memberCode user profileImage',
        populate: { path: 'user', select: 'firstName lastName email phone' },
      })
      .populate('subscription', 'planNameEn planNameAr basePrice finalPrice paidAmount remainingAmount status')
      .populate('paymentMethod', 'nameEn nameAr type')
      .exec();
    if (!payment) throw new NotFoundException('Payment not found');

    const [previousAttempts, auditHistory] = await Promise.all([
      this.paymentModel
        .find({ subscription: payment.subscription, _id: { $ne: payment._id } })
        .select('amount status createdAt rejectionReason receiptNumber')
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.auditLogsService.forEntity('Payment', payment._id),
    ]);

    let signedProofUrl: string | null = null;
    if (payment.proofImagePublicId && this.mediaService) {
      try {
        signedProofUrl = this.mediaService.signedUrl(payment.proofImagePublicId, 600);
      } catch {
        signedProofUrl = payment.proofImageUrl || null;
      }
    }

    return { payment, previousAttempts, auditHistory, signedProofUrl };
  }

  proofUrl(payment: PaymentDocument): string | null {
    if (!payment.proofImagePublicId) return null;
    try {
      return this.mediaService.signedUrl(payment.proofImagePublicId, 600);
    } catch {
      return payment.proofImageUrl || null;
    }
  }

  memberHistory(memberId: string | Types.ObjectId): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ member: memberId })
      .populate('subscription', 'planNameEn planNameAr')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ─────────────────────────── helpers ───────────────────────────

  private async getOpenOrFail(id: string): Promise<PaymentDocument> {
    const payment = await this.getByIdOrFail(id);
    if (!OPEN_STATUSES.includes(payment.status)) {
      throw new BadRequestException(
        `Payment is already ${payment.status.toLowerCase().replace('_', ' ')}`,
      );
    }
    return payment;
  }

  private async maybeRevertSubscription(payment: PaymentDocument): Promise<void> {
    const stillOpen = await this.paymentModel.exists({
      subscription: payment.subscription,
      _id: { $ne: payment._id },
      status: { $in: OPEN_STATUSES },
    });
    if (!stillOpen) {
      await this.subscriptionsService.revertToPending(payment.subscription);
    }
  }
}
