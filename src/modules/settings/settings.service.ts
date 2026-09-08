import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppSetting, AppSettingDocument } from './schemas/app-setting.schema';

interface SettingWrite {
  key: string;
  value: unknown;
  group?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  isPublic?: boolean;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSetting.name) private readonly settingModel: Model<AppSettingDocument>,
  ) {}

  async get<T = unknown>(key: string, fallback: T): Promise<T> {
    const doc = await this.settingModel.findOne({ key }).lean().exec();
    return doc ? (doc.value as T) : fallback;
  }

  all(): Promise<AppSettingDocument[]> {
    return this.settingModel.find().sort({ group: 1, key: 1 }).exec();
  }

  publicAll(): Promise<AppSettingDocument[]> {
    return this.settingModel.find({ isPublic: true }).select('key value group').exec();
  }

  async upsertMany(writes: SettingWrite[], actorId: string): Promise<AppSettingDocument[]> {
    const results: AppSettingDocument[] = [];
    for (const w of writes) {
      const doc = await this.settingModel
        .findOneAndUpdate(
          { key: w.key },
          {
            $set: {
              value: w.value,
              ...(w.group ? { group: w.group } : {}),
              ...(w.descriptionEn !== undefined ? { descriptionEn: w.descriptionEn } : {}),
              ...(w.descriptionAr !== undefined ? { descriptionAr: w.descriptionAr } : {}),
              ...(w.isPublic !== undefined ? { isPublic: w.isPublic } : {}),
              updatedBy: new Types.ObjectId(actorId),
            },
          },
          { new: true, upsert: true },
        )
        .exec();
      results.push(doc);
    }
    return results;
  }
}
