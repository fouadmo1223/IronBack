import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CurrentUser, Permissions, Public, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { SettingsService } from './settings.service';

class SettingItemDto {
  @IsString()
  key!: string;

  value!: unknown;

  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}

class UpdateSettingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  settings!: SettingItemDto[];
}

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @Public()
  @ResponseMessage('Public settings')
  publicSettings() {
    return this.settingsService.publicAll();
  }

  @Get()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  all() {
    return this.settingsService.all();
  }

  @Put()
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Settings saved')
  update(@CurrentUser('id') actorId: string, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.upsertMany(dto.settings, actorId);
  }
}
