import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuditAction } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { paginated } from '../../common/utils/pagination.util';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | Types.ObjectId | null;
  actor?: { id?: string; label?: string; ip?: string; userAgent?: string } | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  page: number;
  limit: number;
  skip: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /** Fire-and-forget: never let audit failure break the business operation. */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditModel.create({
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ? new Types.ObjectId(input.entityId) : null,
        user: input.actor?.id ? new Types.ObjectId(input.actor.id) : null,
        userLabel: input.actor?.label ?? '',
        before: input.before ?? null,
        after: input.after ?? null,
        metadata: input.metadata ?? {},
        ipAddress: input.actor?.ip ?? '',
        userAgent: input.actor?.userAgent ?? '',
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err as Error);
    }
  }

  async list(query: AuditQuery): Promise<PaginatedResult<AuditLogDocument>> {
    const filter: FilterQuery<AuditLogDocument> = {};
    if (query.action) filter.action = query.action as AuditAction;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = new Types.ObjectId(query.entityId);
    if (query.userId) filter.user = new Types.ObjectId(query.userId);

    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  forEntity(entityType: string, entityId: string | Types.ObjectId): Promise<AuditLogDocument[]> {
    return this.auditModel
      .find({ entityType, entityId })
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }
}
