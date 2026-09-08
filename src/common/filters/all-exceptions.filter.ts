import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { ApiFailure } from '../types';

/**
 * Single funnel for every thrown error. Produces the standard failure envelope
 * and never leaks stack traces or driver internals to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        if (Array.isArray(r.message)) {
          message = 'Validation failed';
          errors = r.message;
        }
        if (Array.isArray(r.errors)) errors = r.errors;
      }
    } else if (exception instanceof MongooseError.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      errors = Object.values(exception.errors).map((e) => ({ field: e.path, message: e.message }));
    } else if (exception instanceof MongooseError.CastError) {
      status = HttpStatus.BAD_REQUEST;
      message = `Invalid value for "${exception.path}"`;
      this.logger.debug?.(`CastError at ${exception.path}: ${exception.message}`);
    } else if ((exception as MongoServerError)?.code === 11000) {
      status = HttpStatus.CONFLICT;
      const keys = Object.keys((exception as MongoServerError).keyValue ?? {});
      message = `Duplicate value for ${keys.join(', ') || 'a unique field'}`;
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}: ${message}`);
    }

    const body: ApiFailure = { success: false, message, errors };
    response.status(status).json(body);
  }
}
