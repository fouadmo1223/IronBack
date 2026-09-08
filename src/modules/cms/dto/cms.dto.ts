import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CmsSectionType } from '../../../common/enums';

export class CmsSectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ enum: CmsSectionType })
  @IsString()
  type!: CmsSectionType;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;
}

export class CmsSeoDto {
  @IsOptional() @IsString() titleAr?: string;
  @IsOptional() @IsString() titleEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

export class UpsertCmsPageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty() @IsString() @MinLength(1) nameAr!: string;
  @ApiProperty() @IsString() @MinLength(1) nameEn!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() titleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;

  @ApiPropertyOptional({ type: [CmsSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsSectionDto)
  sections?: CmsSectionDto[];

  @ApiPropertyOptional({ type: CmsSeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CmsSeoDto)
  seo?: CmsSeoDto;
}

export class UpdateSectionsDto {
  @ApiProperty({ type: [CmsSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsSectionDto)
  sections!: CmsSectionDto[];
}

export class UpdateSiteContentDto {
  @IsOptional() @IsObject() brand?: Record<string, unknown>;
  @IsOptional() @IsArray() navItems?: Array<Record<string, unknown>>;
  @IsOptional() @IsObject() footer?: Record<string, unknown>;
  @IsOptional() @IsObject() contact?: Record<string, unknown>;
  @IsOptional() @IsObject() social?: Record<string, unknown>;
  @IsOptional() @IsObject() hours?: Record<string, unknown>;
  @IsOptional() @IsObject() media?: Record<string, unknown>;
  @IsOptional() @IsObject() copy?: Record<string, unknown>;
  @IsOptional() @IsObject() seoDefaults?: Record<string, unknown>;
}
