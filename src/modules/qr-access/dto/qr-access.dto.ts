import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateCardsDto {
  @ApiProperty({ minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  count!: number;
}

export class AssignCardDto {
  @ApiProperty()
  @IsMongoId()
  memberId!: string;

  @ApiPropertyOptional({ description: 'Printed card code, e.g. CARD-000042' })
  @IsOptional()
  @IsString()
  cardCode?: string;

  @ApiPropertyOptional({ description: 'Raw scanned QR value (or IRONGYM:-prefixed)' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description:
      "Replace the member's current credential: release a card back to the pool, delete a digital token, then assign this one.",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  replace?: boolean;
}
