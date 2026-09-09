import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  AllowAccountTypes,
  CurrentUser,
  ParseObjectIdPipe,
  Public,
  ResponseMessage,
} from '../../common';
import { AccountType } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ListContactMessagesDto } from './dto/list-contact-messages.dto';

@ApiTags('Contact')
@Controller('contact-messages')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── Public: website contact form ──
  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('Thanks — we will get back to you shortly.')
  submit(@Body() dto: CreateContactMessageDto, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    return this.contactService.create(dto, {
      ipAddress,
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
  }

  // ── Staff inbox ──
  @Get()
  @ApiBearerAuth()
  @AllowAccountTypes(AccountType.STAFF)
  list(@Query() query: ListContactMessagesDto) {
    return this.contactService.list(query);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @AllowAccountTypes(AccountType.STAFF)
  unreadCount() {
    return this.contactService.countNew().then((count) => ({ count }));
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @AllowAccountTypes(AccountType.STAFF)
  @ResponseMessage('Marked as read')
  markRead(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.markRead(id, user.id);
  }

  @Patch(':id/archive')
  @ApiBearerAuth()
  @AllowAccountTypes(AccountType.STAFF)
  @ResponseMessage('Archived')
  archive(@Param('id', ParseObjectIdPipe) id: string) {
    return this.contactService.setStatus(id, 'ARCHIVED');
  }
}
