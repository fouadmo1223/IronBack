import { AccountType } from '../enums';
import { PermissionKey } from '../constants/permissions';

/** Shape of the JWT access-token payload. */
export interface JwtPayload {
  sub: string;
  accountType: AccountType;
  tokenType: 'access';
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  accountType: AccountType;
  tokenType: 'refresh';
  iat?: number;
  exp?: number;
}

/** Request-scoped authenticated principal, attached by JwtStrategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  language: string;
  roleKey?: string;
  roleId?: string;
  branchId?: string;
  permissions: PermissionKey[];
  isActive: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors: unknown[];
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
