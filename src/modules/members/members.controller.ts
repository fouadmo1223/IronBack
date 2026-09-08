import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { UpdateMemberProfileDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@ApiTags('Members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // ─────────── Member self-service ───────────

  @Get('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Your profile')
  myProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.membersService.getByUserIdOrFail(user.id);
  }

  @Patch('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Profile updated')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberProfileDto,
  ) {
    return this.membersService.updateSelf(user.id, dto);
  }

  // ─────────── Staff administration ───────────

  @Get()
  @Permissions(PERMISSIONS.MEMBER_READ)
  list(@Query() query: MemberQueryDto) {
    return this.membersService.list({
      page: query.page,
      limit: query.limit,
      skip: query.skip,
      search: query.search,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      branchId: query.branchId,
      status: query.status,
      planId: query.planId,
      endFrom: query.endFrom,
      endTo: query.endTo,
      joinedFrom: query.joinedFrom,
      joinedTo: query.joinedTo,
    });
  }

  @Post()
  @Permissions(PERMISSIONS.MEMBER_CREATE)
  @ResponseMessage('Member created')
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.createByStaff(dto);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.MEMBER_READ)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.membersService.getByIdOrFail(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Member updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateMemberProfileDto) {
    return this.membersService.updateByProfileId(id, dto);
  }
}
