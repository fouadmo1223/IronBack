import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWhatsAppTemplateDto {
  @ApiProperty({ example: 'EXPIRY_REMINDER' })
  @IsString()
  @MinLength(2)
  key!: string;

  @ApiProperty() @IsString() @MinLength(2) nameAr!: string;
  @ApiProperty() @IsString() @MinLength(2) nameEn!: string;
  @ApiProperty({ description: 'Supports {{name}} {{plan}} {{expiry_date}} {{remaining_days}} {{amount}} {{remaining_amount}}' })
  @IsString()
  @MinLength(2)
  bodyAr!: string;
  @ApiProperty() @IsString() @MinLength(2) bodyEn!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWhatsAppTemplateDto extends PartialType(CreateWhatsAppTemplateDto) {}

export class GenerateMessagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  memberIds!: string[];

  @ApiProperty()
  @IsString()
  templateKey!: string;

  @ApiPropertyOptional({ enum: ['ar', 'en'], default: 'ar' })
  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: 'ar' | 'en';
}
