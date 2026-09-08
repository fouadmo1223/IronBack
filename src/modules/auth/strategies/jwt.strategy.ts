import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { AccountType } from '../../../common/enums';
import { AuthenticatedUser, JwtPayload } from '../../../common/types';
import { PermissionKey } from '../../../common/constants/permissions';
import { StaffService } from '../../staff/staff.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
    private readonly staffService: StaffService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or disabled');
    }

    const principal: AuthenticatedUser = {
      id: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accountType: user.accountType,
      language: user.language,
      permissions: [],
      isActive: user.isActive,
    };

    if (user.accountType === AccountType.STAFF) {
      const ctx = await this.staffService.resolveContextByUserId(user._id);
      if (!ctx || !ctx.isActive) {
        throw new UnauthorizedException('Staff profile is missing or disabled');
      }
      principal.roleId = ctx.roleId;
      principal.roleKey = ctx.roleKey;
      principal.branchId = ctx.branchId;
      principal.permissions = ctx.permissions as PermissionKey[];
    }

    return principal;
  }
}
