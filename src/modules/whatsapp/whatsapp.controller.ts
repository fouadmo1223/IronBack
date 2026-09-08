import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common';
import {
  CreateWhatsAppTemplateDto,
  GenerateMessagesDto,
  UpdateWhatsAppTemplateDto,
} from './dto/whatsapp.dto';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('templates')
  @Permissions(PERMISSIONS.WHATSAPP_SEND)
  templates() {
    return this.whatsappService.listTemplates(true);
  }

  @Post('templates')
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Template created')
  create(@Body() dto: CreateWhatsAppTemplateDto) {
    return this.whatsappService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Template updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateWhatsAppTemplateDto) {
    return this.whatsappService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Template removed')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.whatsappService.removeTemplate(id);
  }

  @Post('generate')
  @Permissions(PERMISSIONS.WHATSAPP_SEND)
  @ResponseMessage('Messages generated')
  generate(@CurrentUser('id') staffUserId: string, @Body() dto: GenerateMessagesDto) {
    return this.whatsappService.generate(dto, staffUserId);
  }

  @Patch('logs/:id/opened')
  @Permissions(PERMISSIONS.WHATSAPP_SEND)
  @ResponseMessage('Marked as opened')
  async markOpened(@Param('id', ParseObjectIdPipe) id: string) {
    await this.whatsappService.markOpened(id);
    return null;
  }

  @Get('logs')
  @Permissions(PERMISSIONS.WHATSAPP_SEND)
  logs(@Query() query: PaginationQueryDto, @Query('memberId') memberId?: string) {
    return this.whatsappService.listLogs(query.page, query.limit, memberId);
  }
}
