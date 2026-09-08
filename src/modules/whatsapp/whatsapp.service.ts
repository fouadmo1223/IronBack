import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageChannel, MessageLogStatus } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { paginated } from '../../common/utils/pagination.util';
import { MembersService } from '../members/members.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  CreateWhatsAppTemplateDto,
  GenerateMessagesDto,
  UpdateWhatsAppTemplateDto,
} from './dto/whatsapp.dto';
import { MessageLog, MessageLogDocument } from './schemas/message-log.schema';
import {
  WhatsAppTemplate,
  WhatsAppTemplateDocument,
} from './schemas/whatsapp-template.schema';
import { ManualWhatsAppProvider } from './whatsapp.provider';

export interface GeneratedMessage {
  memberId: string;
  name: string;
  phone: string;
  message: string;
  waLink: string;
  messageLogId: string;
}

function applyVars(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
}

@Injectable()
export class WhatsAppService {
  private readonly provider = new ManualWhatsAppProvider();

  constructor(
    @InjectModel(WhatsAppTemplate.name)
    private readonly templateModel: Model<WhatsAppTemplateDocument>,
    @InjectModel(MessageLog.name)
    private readonly logModel: Model<MessageLogDocument>,
    private readonly membersService: MembersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // ─────────────────────────── Templates ───────────────────────────

  listTemplates(includeInactive = true): Promise<WhatsAppTemplateDocument[]> {
    return this.templateModel
      .find(includeInactive ? {} : { isActive: true })
      .sort({ nameEn: 1 })
      .exec();
  }

  async createTemplate(dto: CreateWhatsAppTemplateDto): Promise<WhatsAppTemplateDocument> {
    const key = dto.key.toUpperCase().trim();
    if (await this.templateModel.exists({ key })) {
      throw new BadRequestException(`Template "${key}" already exists`);
    }
    return this.templateModel.create({ ...dto, key });
  }

  async updateTemplate(
    id: string,
    dto: UpdateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateDocument> {
    const tpl = await this.templateModel.findById(id).exec();
    if (!tpl) throw new NotFoundException('Template not found');
    Object.assign(tpl, dto, dto.key ? { key: dto.key.toUpperCase() } : {});
    await tpl.save();
    return tpl;
  }

  async removeTemplate(id: string): Promise<void> {
    const tpl = await this.templateModel.findById(id).exec();
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.isSystem) {
      tpl.isActive = false;
      await tpl.save();
      return;
    }
    await tpl.deleteOne();
  }

  // ─────────────────────────── Message generation ───────────────────────────

  async generate(dto: GenerateMessagesDto, staffUserId: string): Promise<GeneratedMessage[]> {
    const tpl = await this.templateModel
      .findOne({ key: dto.templateKey.toUpperCase(), isActive: true })
      .exec();
    if (!tpl) throw new NotFoundException('Active template not found');

    const lang = dto.language ?? 'ar';
    const body = lang === 'ar' ? tpl.bodyAr : tpl.bodyEn;
    const out: GeneratedMessage[] = [];

    for (const memberId of dto.memberIds) {
      const member = await this.membersService.getByIdOrFail(memberId).catch(() => null);
      if (!member) continue;
      const user = member.user as unknown as {
        firstName: string;
        lastName: string;
        phone: string;
      };
      const sub = await this.subscriptionsService.currentForMember(member._id);
      const resolved = sub ? this.subscriptionsService.resolve(sub) : null;

      const vars: Record<string, string> = {
        name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        plan: sub?.planNameEn ?? sub?.planNameAr ?? '',
        expiry_date: sub?.endDate ? new Date(sub.endDate).toISOString().slice(0, 10) : '',
        remaining_days: resolved ? String(resolved.daysRemaining) : '0',
        amount: sub ? String(sub.finalPrice) : '0',
        remaining_amount: sub ? String(sub.remainingAmount) : '0',
      };

      const message = applyVars(body, vars);
      const prepared = this.provider.prepare(user?.phone ?? '', message);

      const [log] = await this.logModel.create([
        {
          member: member._id,
          phone: user?.phone ?? '',
          templateKey: tpl.key,
          channel: MessageChannel.WHATSAPP_MANUAL,
          renderedText: message,
          variables: vars,
          status: MessageLogStatus.GENERATED,
          sentBy: new Types.ObjectId(staffUserId),
        },
      ]);

      out.push({
        memberId: String(member._id),
        name: vars.name,
        phone: user?.phone ?? '',
        message,
        waLink: prepared.link ?? '',
        messageLogId: String(log._id),
      });
    }
    return out;
  }

  async markOpened(messageLogId: string): Promise<void> {
    await this.logModel
      .updateOne(
        { _id: messageLogId },
        { $set: { status: MessageLogStatus.OPENED } },
      )
      .exec();
  }

  async listLogs(
    page: number,
    limit: number,
    memberId?: string,
  ): Promise<PaginatedResult<MessageLogDocument>> {
    const filter = memberId ? { member: new Types.ObjectId(memberId) } : {};
    const [items, total] = await Promise.all([
      this.logModel
        .find(filter)
        .populate({
          path: 'member',
          select: 'memberCode user',
          populate: { path: 'user', select: 'firstName lastName phone' },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.logModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, page, limit);
  }
}
