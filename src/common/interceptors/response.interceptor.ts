import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { ApiSuccess, PaginatedResult } from '../types';

function isPaginated<T>(value: unknown): value is PaginatedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value &&
    Array.isArray((value as PaginatedResult<T>).items)
  );
}

/**
 * Wraps every controller return value in the standard success envelope.
 * A `{ items, meta }` shape is unwrapped so `meta` sits alongside `data`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<unknown>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<unknown>> {
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Operation completed successfully';

    return next.handle().pipe(
      map((payload): ApiSuccess<unknown> => {
        if (isPaginated(payload)) {
          return {
            success: true,
            message,
            data: payload.items,
            meta: payload.meta as unknown as Record<string, unknown>,
          };
        }
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as Record<string, unknown>) &&
          'meta' in (payload as Record<string, unknown>)
        ) {
          const p = payload as unknown as { data: unknown; meta: Record<string, unknown> };
          return { success: true, message, data: p.data, meta: p.meta };
        }
        return { success: true, message, data: payload ?? null };
      }),
    );
  }
}
