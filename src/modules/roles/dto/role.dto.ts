import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ALL_PERMISSIONS, PermissionKey } from '../../../common/constants/permissions';

export class CreateRoleDto {
  @ApiProperty({ example: 'FRONT_DESK_LEAD' })
  @IsString()
  @MinLength(2)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ isArray: true, enum: ALL_PERMISSIONS })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: PermissionKey[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
