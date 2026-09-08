import { SetMetadata } from '@nestjs/common';
import { AccountType } from '../enums';

export const ACCOUNT_TYPES_KEY = 'allowed_account_types';

/** Restricts a route to one or more account types (MEMBER / STAFF). */
export const AllowAccountTypes = (...types: AccountType[]) =>
  SetMetadata(ACCOUNT_TYPES_KEY, types);
