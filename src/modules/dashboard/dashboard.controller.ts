import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions(PERMISSIONS.DASHBOARD_READ)
  @ResponseMessage('Dashboard summary')
  summary() {
    return this.dashboardService.summary();
  }

  @Get('action-center')
  @Permissions(PERMISSIONS.DASHBOARD_READ)
  @ResponseMessage('Action center')
  actionCenter() {
    return this.dashboardService.actionCenter();
  }
}
