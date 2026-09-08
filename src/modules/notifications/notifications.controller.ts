import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsMongoId, IsString, MinLength } from 'class-validator';
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
import { NotificationsService } from './notifications.service';

class BroadcastDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds!: string[];

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  body!: string;
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
    const sent = await this.notificationsService.emitMany(
      dto.userIds,
      NotificationType.ANNOUNCEMENT,
      { title: dto.title, body: dto.body },
      actor.id,
    );
    return { sent };
  }
}
