import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { AttendanceSource } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ScanCheckInDto {
  @ApiProperty({ description: 'Raw QR token or the IRONGYM:-prefixed value' })
  @IsString()
  @MinLength(6)
  token!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional({ enum: AttendanceSource, default: AttendanceSource.QR_CAMERA })
  @IsOptional()
  @IsIn([AttendanceSource.QR_CAMERA, AttendanceSource.QR_SCANNER])
  source?: AttendanceSource;
}

export class ManualCheckInDto {
  @ApiProperty()
  @IsMongoId()
  memberId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;
}

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'today | week | month | custom' })
  @IsOptional()
  @IsString()
  range?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['APPROVED', 'DENIED_INVALID', 'DENIED_EXPIRED', 'DENIED_FROZEN', 'DENIED_NO_MEMBERSHIP', 'DENIED_PENDING_PAYMENT'])
  accessStatus?: string;
}
