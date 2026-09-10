import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { AccountType } from '../../common/enums';
import { verifyPassword } from '../../common/utils/password.util';
import { generateOpaqueToken, sha256 } from '../../common/utils/token.util';
import { MembersService } from '../members/members.service';
import { StaffService } from '../staff/staff.service';
import { UsersService } from '../users/users.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterMemberDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import { IssuedTokens, TokensService } from './tokens.service';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface PublicUserSource {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: AccountType;
  language: string;
  isActive: boolean;
  isVerified: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(PasswordResetToken.name)
    private readonly resetModel: Model<PasswordResetTokenDocument>,
    private readonly usersService: UsersService,
    private readonly membersService: MembersService,
    private readonly staffService: StaffService,
    private readonly tokensService: TokensService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async registerMember(dto: RegisterMemberDto, meta: RequestMeta) {
    const member = await this.membersService.register({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      language: dto.language,
      primaryBranchId: dto.primaryBranchId,
    });
    const tokens = await this.tokensService.issuePair(member.user, AccountType.MEMBER, meta);
    const profile = await this.membersService.getByIdOrFail(member._id);
    return {
      tokens,
      user: this.publicUser(profile.user as unknown as PublicUserSource),
      member: profile,
    };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<{ tokens: IssuedTokens; user: unknown }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !(await verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Your account has been banned. Contact the gym for details.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account is disabled');
    }
    const tokens = await this.tokensService.issuePair(user._id, user.accountType, meta);
    await this.usersService.markLogin(user._id);
    return { tokens, user: this.publicUser(user) };
  }

  refresh(refreshToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    return this.tokensService.rotate(refreshToken, meta);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) await this.tokensService.revokeByRawToken(refreshToken);
  }

  async me(userId: string) {
    const user = await this.usersService.getByIdOrFail(userId);
    const base = this.publicUser(user);
    if (user.accountType === AccountType.MEMBER) {
      const member = await this.membersService.findByUserId(userId);
      return { ...base, memberCode: member?.memberCode ?? null, memberProfileId: member?._id ?? null };
    }
    const ctx = await this.staffService.resolveContextByUserId(userId);
    return {
      ...base,
      roleKey: ctx?.roleKey ?? null,
      branchId: ctx?.branchId ?? null,
      permissions: ctx?.permissions ?? [],
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ devToken?: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    // Always return success to avoid account enumeration.
    if (!user) return {};

    const rawToken = generateOpaqueToken(32);
    const ttl = this.parseDurationMs(
      this.config.get('jwt.passwordResetExpiresIn', { infer: true }),
    );
    await this.resetModel.create({
      user: user._id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + ttl),
    });
    this.logger.log(`Password reset requested for ${user.email}`);
    // In production this token is emailed; exposed here only outside production.
    return this.config.get('isProduction', { infer: true }) ? {} : { devToken: rawToken };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.resetModel
      .findOne({ tokenHash: sha256(dto.token), usedAt: null })
      .exec();
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.usersService.setPassword(record.user, dto.newPassword);
    record.usedAt = new Date();
    await record.save();
    await this.tokensService.revokeAllForUser(record.user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }
    await this.usersService.setPassword(user._id, dto.newPassword);
    await this.tokensService.revokeAllForUser(user._id);
  }

  private publicUser(user: PublicUserSource) {
    return {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone,
      accountType: user.accountType,
      language: user.language,
      isActive: user.isActive,
      isVerified: user.isVerified,
    };
  }

  private parseDurationMs(input: string): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(input.trim());
    if (!match) return 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}
