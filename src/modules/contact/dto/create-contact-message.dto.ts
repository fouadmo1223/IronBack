import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Single-line fields: strip control chars + angle brackets, collapse whitespace. */
const cleanLine = (v: unknown): string =>
  typeof v === 'string'
    ? v.replace(CONTROL, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
    : (v as string);

/** Multi-line: keep newlines, strip other control chars + angle brackets. */
const cleanBlock = (v: unknown): string =>
  typeof v === 'string'
    ? v
        .replace(/\r\n?/g, '\n')
        .replace(CONTROL, '')
        .replace(/[<>]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : (v as string);

export class CreateContactMessageDto {
  @ApiProperty()
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty()
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

  @ApiProperty()
  @Transform(({ value }) => cleanBlock(value))
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message!: string;
}
