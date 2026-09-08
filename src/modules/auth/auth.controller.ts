import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, ResponseMessage } from '../../common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterMemberDto,
  ResetPasswordDto,
} from './dto/auth.dto';

function meta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? '',
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('Registration successful')
  register(@Body() dto: RegisterMemberDto, @Req() req: Request) {
    return this.authService.registerMember(dto, meta(req));
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Login successful')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, meta(req));
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ResponseMessage('Token refreshed')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, meta(req));
  }

  @Post('logout')
  @Public()
  @ResponseMessage('Logged out')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return null;
  }

  @Get('me')
  @ApiBearerAuth()
  @ResponseMessage('Current user')
  me(@CurrentUser('id') id: string) {
    return this.authService.me(id);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('If the email exists, a reset link has been sent')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ResponseMessage('Password has been reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return null;
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ResponseMessage('Password changed')
  async changePassword(@CurrentUser('id') id: string, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(id, dto);
    return null;
  }
}
