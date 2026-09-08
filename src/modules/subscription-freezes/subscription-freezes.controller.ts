import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AllowAccountTypes,
  CurrentUser,
  ParseObjectIdPipe,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AccountType } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types';
import { MembersService } from '../members/members.service';
import {
  DecideFreezeDto,
  FreezeQueryDto,
  RequestFreezeDto,
} from './dto/subscription-freeze.dto';
import { SubscriptionFreezesService } from './subscription-freezes.service';

@ApiTags('Subscription Freezes')
@ApiBearerAuth()
@Controller('subscription-freezes')
export class SubscriptionFreezesController {
  constructor(
    private readonly freezesService: SubscriptionFreezesService,
    private readonly membersService: MembersService,
  ) {}

  // ─────────── Member ───────────

  @Post('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Freeze request submitted')
  async requestSelf(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestFreezeDto) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    return this.freezesService.request(dto, user.id, { enforceMemberId: String(member._id) });
  }

  @Get('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Your freeze requests')
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    return this.freezesService.listForMember(member._id);
  }

  @Post('me/:id/cancel')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Freeze request cancelled')
  async cancelSelf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    return this.freezesService.cancel(id, String(member._id));
  }

  // ─────────── Staff ───────────

  @Get()
  @Permissions(PERMISSIONS.SUBSCRIPTION_READ)
  list(@Query() query: FreezeQueryDto) {
    return this.freezesService.list(query);
  }

  @Post()
  @Permissions(PERMISSIONS.SUBSCRIPTION_FREEZE)
  @ResponseMessage('Freeze request created')
  createByStaff(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestFreezeDto) {
    return this.freezesService.request(dto, user.id);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.SUBSCRIPTION_FREEZE)
  @ResponseMessage('Freeze approved')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DecideFreezeDto,
  ) {
    return this.freezesService.approve(id, user.id, dto.note);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.SUBSCRIPTION_FREEZE)
  @ResponseMessage('Freeze rejected')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DecideFreezeDto,
  ) {
    return this.freezesService.reject(id, user.id, dto.note);
  }
}
