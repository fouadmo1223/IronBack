import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AppSetting, AppSettingSchema } from './schemas/app-setting.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AppSetting.name, schema: AppSettingSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
