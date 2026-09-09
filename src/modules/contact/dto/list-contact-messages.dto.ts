import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { ContactMessageStatus } from '../schemas/contact-message.schema';

export class ListContactMessagesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['NEW', 'READ', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['NEW', 'READ', 'ARCHIVED'])
  status?: ContactMessageStatus;
}
