import { PaginatedResult, PaginationMeta } from '../types';

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

export function buildSort(
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc',
  fallback = 'createdAt',
): Record<string, 1 | -1> {
  return { [sortBy || fallback]: sortDir === 'asc' ? 1 : -1 };
}
