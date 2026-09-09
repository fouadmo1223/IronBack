import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/types';
import { paginated } from '../../common/utils/pagination.util';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ListContactMessagesDto } from './dto/list-contact-messages.dto';
import {
  ContactMessage,
  ContactMessageDocument,
} from './schemas/contact-message.schema';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name)
    private readonly model: Model<ContactMessageDocument>,
  ) {}

  async create(
    dto: CreateContactMessageDto,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ id: string }> {
    const doc = await this.model.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message,
      ipAddress: meta.ipAddress ?? '',
      userAgent: (meta.userAgent ?? '').slice(0, 400),
    });
    return { id: String(doc._id) };
  }

  async list(query: ListContactMessagesDto): Promise<PaginatedResult<ContactMessageDocument>> {
    const filter: FilterQuery<ContactMessageDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { message: rx }];
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: query.sortDir === 'asc' ? 1 : -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  countNew(): Promise<number> {
    return this.model.countDocuments({ status: 'NEW' }).exec();
  }

  async markRead(id: string, userId: string | Types.ObjectId): Promise<ContactMessageDocument> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Message not found');
    if (doc.status === 'NEW') {
      doc.status = 'READ';
      doc.readBy = new Types.ObjectId(userId);
      doc.readAt = new Date();
      await doc.save();
    }
    return doc;
  }

  async setStatus(
    id: string,
    status: 'NEW' | 'READ' | 'ARCHIVED',
  ): Promise<ContactMessageDocument> {
    const doc = await this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Message not found');
    return doc;
  }
}
