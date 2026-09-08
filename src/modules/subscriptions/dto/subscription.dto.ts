import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Member self-service: pick a plan to subscribe / renew. */
export class CreateSelfSubscriptionDto {
  @ApiProperty()
  @IsMongoId()
  planId!: string;

  @ApiPropertyOptional({ description: 'Preferred branch' })
  @IsOptional()
  @IsMongoId()
  branchId?: string;
}

/** Staff creating a subscription on a member's behalf. */
export class CreateSubscriptionDto {
  @ApiProperty()
  @IsMongoId()
  memberId!: string;

  @ApiProperty()
  @IsMongoId()
  planId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Absolute discount off the plan price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CancelSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class SubscriptionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;
}
