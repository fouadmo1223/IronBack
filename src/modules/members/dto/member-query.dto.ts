import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class MemberQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by primary branch' })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Membership status filter: active | expiring_soon | expired | frozen | none | pending_payment | payment_under_review | outstanding',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by plan id' })
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @ApiPropertyOptional({ description: 'Subscription ends on/after (ISO date)' })
  @IsOptional()
  @IsDateString()
  endFrom?: string;

  @ApiPropertyOptional({ description: 'Subscription ends on/before (ISO date)' })
  @IsOptional()
  @IsDateString()
  endTo?: string;

  @ApiPropertyOptional({ description: 'Member joined on/after (ISO date)' })
  @IsOptional()
  @IsDateString()
  joinedFrom?: string;

  @ApiPropertyOptional({ description: 'Member joined on/before (ISO date)' })
  @IsOptional()
  @IsDateString()
  joinedTo?: string;
}
