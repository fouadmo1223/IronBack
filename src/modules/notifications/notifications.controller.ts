import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CurrentUser,
  ParseObjectIdPipe,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { NotificationType } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsService, type BroadcastAudience } from './notifications.service';

const BROADCAST_TYPES = [
  NotificationType.ANNOUNCEMENT,
  NotificationType.PROMOTION,
  NotificationType.SYSTEM,
] as const;

class BroadcastDto {
  @IsIn(['all', 'members', 'staff', 'custom'])
  audience!: BroadcastAudience;

  @ValidateIf((o) => o.audience === 'custom')
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsIn(BROADCAST_TYPES as unknown as string[])
  type?: NotificationType;

  @IsString() @MinLength(2) titleEn!: string;
  @IsString() @MinLength(2) titleAr!: string;
  @IsString() @MinLength(2) messageEn!: string;
  @IsString() @MinLength(2) messageAr!: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ResponseMessage('Notifications')
  list(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.listForUser(
      userId,
      query.page,
      query.limit,
      unread === 'true',
    );
  }

  @Get('unread-count')
  @ResponseMessage('Unread count')
  async unreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.notificationsService.unreadCount(userId) };
  }

  @Patch(':id/read')
  @ResponseMessage('Marked as read')
  async markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.notificationsService.markRead(userId, id);
    return null;
  }

  @Patch('read-all')
  @ResponseMessage('All marked as read')
  async markAllRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllRead(userId);
    return null;
  }

  @Post('broadcast')
  @Permissions(PERMISSIONS.NOTIFICATIONS_SEND)
  @ResponseMessage('Announcement sent')
  async broadcast(@CurrentUser() actor: AuthenticatedUser, @Body() dto: BroadcastDto) {
    const recipients = await this.notificationsService.resolveAudience(
      dto.audience,
      dto.userIds ?? [],
    );
    const sent = await this.notificationsService.emitBilingual(
      recipients,
      dto.type ?? NotificationType.ANNOUNCEMENT,
      {
        titleEn: dto.titleEn,
        titleAr: dto.titleAr,
        messageEn: dto.messageEn,
        messageAr: dto.messageAr,
      },
      actor.id,
    );
    return { sent, audience: dto.audience };
  }
}
