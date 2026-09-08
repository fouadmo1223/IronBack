import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Language } from '../../../common/enums';

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export class RegisterMemberDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ minLength: 8, description: 'Min 8 chars, upper + lower + digit' })
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'Password must be at least 8 characters and include upper, lower and a digit',
  })
  password!: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  language?: Language;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  primaryBranchId?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'Password must be at least 8 characters and include upper, lower and a digit',
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'Password must be at least 8 characters and include upper, lower and a digit',
  })
  newPassword!: string;
}
