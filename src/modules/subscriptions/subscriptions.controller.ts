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
  CancelSubscriptionDto,
  CreateSelfSubscriptionDto,
  CreateSubscriptionDto,
  SubscriptionQueryDto,
} from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly membersService: MembersService,
  ) {}

  // ─────────── Member self-service ───────────

  @Post('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Subscription created — complete payment to activate')
  async subscribeSelf(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSelfSubscriptionDto,
  ) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    const sub = await this.subscriptionsService.create({
      memberId: String(member._id),
      planId: dto.planId,
      branchId: dto.branchId,
      selfServe: true,
    });
    return this.subscriptionsService.view(sub);
  }

  @Get('me/current')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Current subscription')
  async myCurrent(@CurrentUser() user: AuthenticatedUser) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    const sub = await this.subscriptionsService.currentForMember(member._id);
    return sub ? this.subscriptionsService.view(sub) : null;
  }

  @Get('me/history')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Subscription history')
  async myHistory(@CurrentUser() user: AuthenticatedUser) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    const subs = await this.subscriptionsService.historyForMember(member._id);
    return subs.map((s) => this.subscriptionsService.view(s));
  }

  // ─────────── Staff ───────────

  @Get()
  @Permissions(PERMISSIONS.SUBSCRIPTION_READ)
  list(@Query() query: SubscriptionQueryDto) {
    return this.subscriptionsService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SUBSCRIPTION_READ)
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    const sub = await this.subscriptionsService.getByIdOrFail(id);
    return this.subscriptionsService.view(sub);
  }

  @Post()
  @Permissions(PERMISSIONS.SUBSCRIPTION_CREATE)
  @ResponseMessage('Subscription created')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionDto) {
    const sub = await this.subscriptionsService.create({
      memberId: dto.memberId,
      planId: dto.planId,
      branchId: dto.branchId,
      discountAmount: dto.discountAmount,
      createdBy: user.id,
    });
    return this.subscriptionsService.view(sub);
  }

  @Post(':id/cancel')
  @Permissions(PERMISSIONS.SUBSCRIPTION_CANCEL)
  @ResponseMessage('Subscription cancelled')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const sub = await this.subscriptionsService.cancel(id, dto.reason, user.id);
    return this.subscriptionsService.view(sub);
  }
}
