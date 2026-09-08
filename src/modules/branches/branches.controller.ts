import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, Public, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { BranchesService } from './branches.service';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('public')
  @Public()
  @ResponseMessage('Active branches')
  listPublic() {
    return this.branchesService.findAll(false);
  }

  @Get()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BRANCH_MANAGE)
  findAll() {
    return this.branchesService.findAll(true);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BRANCH_MANAGE)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.branchesService.getByIdOrFail(id);
  }

  @Post()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BRANCH_MANAGE)
  @ResponseMessage('Branch created')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BRANCH_MANAGE)
  @ResponseMessage('Branch updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.BRANCH_MANAGE)
  @ResponseMessage('Branch deactivated')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.branchesService.remove(id);
  }
}
