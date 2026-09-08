import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuditLogsService } from './audit-logs.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Permissions(PERMISSIONS.AUDIT_READ)
  list(@Query() query: AuditQueryDto) {
    return this.auditLogsService.list({
      page: query.page,
      limit: query.limit,
      skip: query.skip,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      userId: query.userId,
    });
  }

  @Get('entity/:type/:id')
  @Permissions(PERMISSIONS.AUDIT_READ)
  forEntity(@Param('type') type: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.auditLogsService.forEntity(type, id);
  }
}
