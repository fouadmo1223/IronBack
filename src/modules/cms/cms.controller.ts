import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, Public, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  UpdateSectionsDto,
  UpdateSiteContentDto,
  UpsertCmsPageDto,
} from './dto/cms.dto';
import { CmsService } from './cms.service';

@ApiTags('CMS')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  // ─────────── Public ───────────

  @Get('public/site')
  @Public()
  @ResponseMessage('Site content')
  publicSite() {
    return this.cmsService.publicSite();
  }

  @Get('public/pages/:slug')
  @Public()
  @ResponseMessage('Page content')
  publicPage(@Param('slug') slug: string) {
    return this.cmsService.publicPage(slug);
  }

  // ─────────── Admin ───────────

  @Get('pages')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_READ)
  listPages() {
    return this.cmsService.listPages();
  }

  @Get('pages/:slug')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_READ)
  getPage(@Param('slug') slug: string) {
    return this.cmsService.getPage(slug);
  }

  @Put('pages')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_UPDATE)
  @ResponseMessage('Page saved')
  upsert(@CurrentUser('id') actorId: string, @Body() dto: UpsertCmsPageDto) {
    return this.cmsService.upsertPage(dto, actorId);
  }

  @Patch('pages/:slug/sections')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_UPDATE)
  @ResponseMessage('Sections updated')
  updateSections(
    @CurrentUser('id') actorId: string,
    @Param('slug') slug: string,
    @Body() dto: UpdateSectionsDto,
  ) {
    return this.cmsService.updateSections(slug, dto, actorId);
  }

  @Post('pages/:slug/publish')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_UPDATE)
  @ResponseMessage('Page published')
  publish(@CurrentUser('id') actorId: string, @Param('slug') slug: string) {
    return this.cmsService.setPublished(slug, true, actorId);
  }

  @Post('pages/:slug/unpublish')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_UPDATE)
  @ResponseMessage('Page unpublished')
  unpublish(@CurrentUser('id') actorId: string, @Param('slug') slug: string) {
    return this.cmsService.setPublished(slug, false, actorId);
  }

  @Get('site')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_READ)
  getSite() {
    return this.cmsService.getSite();
  }

  @Put('site')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.CMS_UPDATE)
  @ResponseMessage('Site content updated')
  updateSite(@CurrentUser('id') actorId: string, @Body() dto: UpdateSiteContentDto) {
    return this.cmsService.updateSite(dto, actorId);
  }
}
