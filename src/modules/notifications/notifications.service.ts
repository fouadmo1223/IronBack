import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { AccountType, NotificationType } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { paginated } from '../../common/utils/pagination.util';
import { renderNotification } from './notification-templates';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

export type BroadcastAudience = 'all' | 'members' | 'staff' | 'custom';

export interface BilingualText {
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
}

export interface EmitInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  vars?: Record<string, string | number>;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /** Resolve a broadcast audience to a list of recipient user ids. */
  async resolveAudience(
    audience: BroadcastAudience,
    customIds: string[] = [],
  ): Promise<Types.ObjectId[]> {
    if (audience === 'custom') return customIds.map((id) => new Types.ObjectId(id));
    const filter: Record<string, unknown> = { isActive: true };
    if (audience === 'members') filter.accountType = AccountType.MEMBER;
    if (audience === 'staff') filter.accountType = AccountType.STAFF;
    const rows = await this.userModel.find(filter).select('_id').lean().exec();
    return rows.map((r) => r._id as Types.ObjectId);
  }

  /** Insert a ready-rendered bilingual notification for many users at once. */
  async emitBilingual(
    userIds: Array<string | Types.ObjectId>,
    type: NotificationType,
    text: BilingualText,
    createdBy?: string,
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    const by = createdBy ? new Types.ObjectId(createdBy) : null;
    const docs = userIds.map((uid) => ({
      user: new Types.ObjectId(uid),
      type,
      titleAr: text.titleAr,
      titleEn: text.titleEn,
      messageAr: text.messageAr,
      messageEn: text.messageEn,
      metadata: { broadcast: true },
      createdBy: by,
    }));
    const res = await this.notificationModel.insertMany(docs, { ordered: false });
    return res.length;
  }

  async emit(input: EmitInput, session?: ClientSession): Promise<void> {
    try {
      const text = renderNotification(input.type, input.vars ?? {});
      await this.notificationModel.create(
        [
          {
            user: new Types.ObjectId(input.userId),
            type: input.type,
            ...text,
            metadata: input.metadata ?? {},
            createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : null,
          },
        ],
        { session },
      );
    } catch (err) {
      this.logger.error(`Failed to emit ${input.type} notification`, err as Error);
    }
  }

  async emitMany(
    userIds: Array<string | Types.ObjectId>,
    type: NotificationType,
    vars: Record<string, string | number>,
    createdBy?: string,
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    const text = renderNotification(type, vars);
    const docs = userIds.map((uid) => ({
      user: new Types.ObjectId(uid),
      type,
      ...text,
      metadata: {},
      createdBy: createdBy ? new Types.ObjectId(createdBy) : null,
    }));
    const res = await this.notificationModel.insertMany(docs, { ordered: false });
    return res.length;
  }

  async listForUser(
    userId: string,
    page: number,
    limit: number,
    onlyUnread = false,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter = onlyUnread
      ? { user: new Types.ObjectId(userId), isRead: false }
      : { user: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, page, limit);
  }

  unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ user: new Types.ObjectId(userId), isRead: false })
      .exec();
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationModel
      .updateOne(
        { _id: notificationId, user: new Types.ObjectId(userId) },
        { $set: { isRead: true, readAt: new Date() } },
      )
      .exec();
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        { user: new Types.ObjectId(userId), isRead: false },
        { $set: { isRead: true, readAt: new Date() } },
      )
      .exec();
  }
}
