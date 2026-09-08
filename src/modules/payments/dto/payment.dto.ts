import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Member submits transfer proof. `proof` is the multipart file, handled separately. */
export class SubmitPaymentDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId!: string;

  @ApiProperty()
  @IsMongoId()
  paymentMethodId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  senderName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  senderPhone!: string;

  @ApiProperty({ example: '2026-09-07' })
  @IsDateString()
  transferDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  memberNotes?: string;
}

export class RecordManualPaymentDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  paymentMethodId?: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ description: 'Shown to the member' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class MarkFakePaymentDto {
  @ApiProperty({ description: 'Internal only — not shown to the member' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  internalReason!: string;
}

export class AdminNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

export class RefundPaymentDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

const TAB_VALUES = [
  'under_review',
  'approved',
  'rejected',
  'fake',
  'cancelled',
  'refund_requested',
  'refunded',
  'all',
] as const;

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TAB_VALUES, default: 'under_review' })
  @IsOptional()
  @IsIn(TAB_VALUES as unknown as string[])
  tab?: (typeof TAB_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  subscriptionId?: string;
}
