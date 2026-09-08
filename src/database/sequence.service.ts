import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Counter, CounterDocument } from './schemas/counter.schema';

@Injectable()
export class SequenceService {
  constructor(@InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>) {}

  /** Returns the next integer in the named sequence, creating it at 1 on first use. */
  async next(key: string, session?: ClientSession): Promise<number> {
    const doc = await this.counterModel
      .findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { new: true, upsert: true, session },
      )
      .exec();
    return doc.value;
  }

  /** Zero-padded formatted sequence, e.g. formatted('member', 6, 'IRON-') -> IRON-000042. */
  async formatted(
    key: string,
    pad: number,
    prefix = '',
    session?: ClientSession,
  ): Promise<string> {
    const n = await this.next(key, session);
    return `${prefix}${String(n).padStart(pad, '0')}`;
  }
}
