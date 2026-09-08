import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionKey } from '../constants/permissions';
import { ACCOUNT_TYPES_KEY } from '../decorators/account-type.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccountType } from '../enums';
import { AuthenticatedUser } from '../types';

/**
 * Enforces `@Permissions(...)` and `@AllowAccountTypes(...)`. Runs after
 * JwtAuthGuard, so `request.user` is always populated for protected routes.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowedTypes = this.reflector.getAllAndOverride<AccountType[]>(ACCOUNT_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');
    if (!user.isActive) throw new ForbiddenException('Account is disabled');

    if (allowedTypes?.length && !allowedTypes.includes(user.accountType)) {
      throw new ForbiddenException('This resource is not available for your account type');
    }

    if (!required?.length) return true;

    if (user.accountType !== AccountType.STAFF) {
      throw new ForbiddenException('Staff access required');
    }

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(', ')}`);
    }
    return true;
  }
}
