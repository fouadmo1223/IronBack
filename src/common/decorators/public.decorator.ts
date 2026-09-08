import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public_route';

/** Marks a route as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
