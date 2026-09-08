import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';

/** Validates a route/query param is a well-formed Mongo ObjectId. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!isValidObjectId(value)) {
      throw new BadRequestException('Invalid resource identifier');
    }
    return new Types.ObjectId(value);
  }
}
