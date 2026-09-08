import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditAction } from '../../common/enums';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  UpdateSectionsDto,
  UpdateSiteContentDto,
  UpsertCmsPageDto,
} from './dto/cms.dto';
import { CmsPage, CmsPageDocument } from './schemas/cms-page.schema';
import { SiteContent, SiteContentDocument } from './schemas/site-content.schema';

@Injectable()
export class CmsService {
  constructor(
    @InjectModel(CmsPage.name) private readonly pageModel: Model<CmsPageDocument>,
    @InjectModel(SiteContent.name) private readonly siteModel: Model<SiteContentDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ─────────────────────────── Public (frontend) ───────────────────────────

  async publicPage(slug: string): Promise<CmsPageDocument> {
    const page = await this.pageModel
      .findOne({ slug: slug.toLowerCase(), isPublished: true })
      .lean<CmsPageDocument>()
      .exec();
    if (!page) throw new NotFoundException('Page not found');
    page.sections = (page.sections ?? [])
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
    return page;
  }

  async publicSite() {
    const site = await this.siteModel.findOne({ key: 'site' }).lean().exec();
    return site ?? (await this.siteModel.create({ key: 'site' })).toJSON();
  }

  // ─────────────────────────── Admin ───────────────────────────

  listPages(): Promise<CmsPageDocument[]> {
    return this.pageModel.find().select('slug nameAr nameEn isPublished publishedAt updatedAt').exec();
  }

  async getPage(slug: string): Promise<CmsPageDocument> {
    const page = await this.pageModel.findOne({ slug: slug.toLowerCase() }).exec();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async upsertPage(dto: UpsertCmsPageDto, actorId: string): Promise<CmsPageDocument> {
    const slug = dto.slug.toLowerCase().trim();
    const before = await this.pageModel.findOne({ slug }).lean().exec();
    const page = await this.pageModel
      .findOneAndUpdate(
        { slug },
        {
          $set: {
            nameAr: dto.nameAr,
            nameEn: dto.nameEn,
            titleAr: dto.titleAr ?? '',
            titleEn: dto.titleEn ?? '',
            descriptionAr: dto.descriptionAr ?? '',
            descriptionEn: dto.descriptionEn ?? '',
            ...(dto.sections ? { sections: dto.sections } : {}),
            ...(dto.seo ? { seo: dto.seo } : {}),
            updatedBy: new Types.ObjectId(actorId),
          },
        },
        { new: true, upsert: true },
      )
      .exec();

    await this.auditLogsService.record({
      action: AuditAction.CMS_UPDATED,
      entityType: 'CmsPage',
      entityId: page._id,
      actor: { id: actorId },
      before: before ?? null,
      metadata: { slug },
    });
    return page;
  }

  async updateSections(
    slug: string,
    dto: UpdateSectionsDto,
    actorId: string,
  ): Promise<CmsPageDocument> {
    const page = await this.getPage(slug);
    page.sections = dto.sections as CmsPageDocument['sections'];
    page.updatedBy = new Types.ObjectId(actorId);
    await page.save();
    await this.auditLogsService.record({
      action: AuditAction.CMS_UPDATED,
      entityType: 'CmsPage',
      entityId: page._id,
      actor: { id: actorId },
      metadata: { slug, change: 'sections' },
    });
    return page;
  }

  async setPublished(
    slug: string,
    published: boolean,
    actorId: string,
  ): Promise<CmsPageDocument> {
    const page = await this.getPage(slug);
    page.isPublished = published;
    page.publishedAt = published ? new Date() : null;
    page.updatedBy = new Types.ObjectId(actorId);
    await page.save();
    await this.auditLogsService.record({
      action: AuditAction.CMS_UPDATED,
      entityType: 'CmsPage',
      entityId: page._id,
      actor: { id: actorId },
      metadata: { slug, published },
    });
    return page;
  }

  getSite(): Promise<SiteContentDocument> {
    return this.siteModel
      .findOneAndUpdate({ key: 'site' }, { $setOnInsert: { key: 'site' } }, { new: true, upsert: true })
      .exec();
  }

  async updateSite(dto: UpdateSiteContentDto, actorId: string): Promise<SiteContentDocument> {
    const site = await this.siteModel
      .findOneAndUpdate(
        { key: 'site' },
        { $set: { ...dto } },
        { new: true, upsert: true },
      )
      .exec();
    await this.auditLogsService.record({
      action: AuditAction.CMS_UPDATED,
      entityType: 'SiteContent',
      entityId: site._id,
      actor: { id: actorId },
      metadata: { fields: Object.keys(dto) },
    });
    return site;
  }
}
