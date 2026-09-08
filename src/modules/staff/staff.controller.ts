import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CreateStaffDto, QueryStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions(PERMISSIONS.STAFF_MANAGE)
  list(@Query() query: QueryStaffDto) {
    return this.staffService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.STAFF_MANAGE)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.staffService.getByIdOrFail(id);
  }

  @Post()
  @Permissions(PERMISSIONS.STAFF_MANAGE)
  @ResponseMessage('Staff member created')
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.STAFF_MANAGE)
  @ResponseMessage('Staff member updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.STAFF_MANAGE)
  @ResponseMessage('Staff member deactivated')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.staffService.deactivate(id);
  }
}
