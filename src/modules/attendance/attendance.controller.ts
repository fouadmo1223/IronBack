import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AllowAccountTypes,
  CurrentUser,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AccountType, AttendanceSource } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MembersService } from '../members/members.service';
import { AttendanceService } from './attendance.service';
import {
  AttendanceQueryDto,
  ManualCheckInDto,
  ScanCheckInDto,
} from './dto/attendance.dto';

@ApiTags('Attendance & Check-in')
@ApiBearerAuth()
@Controller()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly membersService: MembersService,
  ) {}

  // ─────────── Reception check-in ───────────

  @Post('access/scan')
  @Permissions(PERMISSIONS.ACCESS_SCAN)
  @ResponseMessage('Scan processed')
  scan(@CurrentUser('id') staffUserId: string, @Body() dto: ScanCheckInDto) {
    return this.attendanceService.processScan({
      rawToken: dto.token,
      branchId: dto.branchId,
      source: dto.source ?? AttendanceSource.QR_CAMERA,
      staffUserId,
    });
  }

  @Post('access/manual-check-in')
  @Permissions(PERMISSIONS.ATTENDANCE_CREATE)
  @ResponseMessage('Manual check-in processed')
  manual(@CurrentUser('id') staffUserId: string, @Body() dto: ManualCheckInDto) {
    return this.attendanceService.processScan({
      memberProfileId: dto.memberId,
      branchId: dto.branchId,
      source: AttendanceSource.MANUAL,
      staffUserId,
    });
  }

  // ─────────── History ───────────

  @Get('attendance')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  list(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.list(query);
  }

  @Get('attendance/me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Your attendance history')
  async mine(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    const member = await this.membersService.getByUserIdOrFail(userId);
    return this.attendanceService.memberHistory(member._id, query.page, query.limit);
  }
}
