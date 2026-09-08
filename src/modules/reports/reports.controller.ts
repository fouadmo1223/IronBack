import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ReportRangeDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Permissions(PERMISSIONS.REPORTS_READ)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('membership-growth')
  membershipGrowth(@Query() q: ReportRangeDto) {
    return this.reportsService.membershipGrowth(q);
  }

  @Get('revenue-trend')
  revenueTrend(@Query() q: ReportRangeDto) {
    return this.reportsService.revenueTrend(q);
  }

  @Get('revenue-by-method')
  revenueByMethod(@Query() q: ReportRangeDto) {
    return this.reportsService.revenueByMethod(q);
  }

  @Get('revenue-by-plan')
  revenueByPlan(@Query() q: ReportRangeDto) {
    return this.reportsService.revenueByPlan(q);
  }

  @Get('payment-outcomes')
  paymentOutcomes(@Query() q: ReportRangeDto) {
    return this.reportsService.paymentOutcomes(q);
  }

  @Get('subscriptions-by-plan')
  subscriptionsByPlan() {
    return this.reportsService.subscriptionsByPlan();
  }

  @Get('subscription-status')
  subscriptionStatus() {
    return this.reportsService.subscriptionStatusBreakdown();
  }

  @Get('renewal-rate')
  renewalRate(@Query() q: ReportRangeDto) {
    return this.reportsService.renewalRate(q);
  }

  @Get('attendance-trend')
  attendanceTrend(@Query() q: ReportRangeDto) {
    return this.reportsService.attendanceTrend(q);
  }

  @Get('peak-hours')
  peakHours(@Query() q: ReportRangeDto) {
    return this.reportsService.peakHours(q);
  }

  @Get('most-active-members')
  mostActiveMembers(@Query() q: ReportRangeDto) {
    return this.reportsService.mostActiveMembers(q);
  }

  @Get('inactive-members')
  inactiveMembers(@Query('days') days?: string) {
    return this.reportsService.inactiveMembers(days ? Number(days) : 30);
  }

  @Get('outstanding-balances')
  outstandingBalances() {
    return this.reportsService.outstandingBalances();
  }
}
