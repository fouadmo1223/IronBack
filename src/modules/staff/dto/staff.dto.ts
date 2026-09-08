import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsMongoId()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitleAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitleEn?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitleAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitleEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryStaffDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;
}
