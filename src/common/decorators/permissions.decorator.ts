import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../constants/permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Requires the caller to hold every listed permission.
 * Use on staff-only routes: `@Permissions('payment.approve')`.
 */
export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
