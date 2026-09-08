import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, Public, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Get('public')
  @Public()
  @ResponseMessage('Available plans')
  listPublic() {
    return this.plansService.findAll(false);
  }

  @Get()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PLAN_READ)
  list() {
    return this.plansService.findAll(true);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PLAN_READ)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.plansService.getByIdOrFail(id);
  }

  @Post()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PLAN_CREATE)
  @ResponseMessage('Plan created')
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PLAN_UPDATE)
  @ResponseMessage('Plan updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.PLAN_DELETE)
  @ResponseMessage('Plan archived')
  archive(@Param('id', ParseObjectIdPipe) id: string) {
    return this.plansService.archive(id);
  }
}
