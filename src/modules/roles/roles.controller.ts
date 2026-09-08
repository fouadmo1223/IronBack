import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions/catalog')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ResponseMessage('Permission catalog')
  catalog() {
    return this.rolesService.listPermissionCatalog();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rolesService.getByIdOrFail(id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ResponseMessage('Role created')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ResponseMessage('Role updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ResponseMessage('Role deleted')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
