import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PaymentMethodType } from '../../../common/enums';

export class CreatePaymentMethodDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  nameEn!: string;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @ApiPropertyOptional() @IsOptional() @IsString() accountName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() iban?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instructionsAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instructionsEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoPublicId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdatePaymentMethodDto extends PartialType(CreatePaymentMethodDto) {}
