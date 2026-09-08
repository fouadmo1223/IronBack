import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  ParseObjectIdPipe,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { MediaFolder } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types';
import { MediaQueryDto, UpdateMediaAssetDto } from './dto/media.dto';
import { MediaService, UploadFile } from './media.service';

@ApiTags('Media Library')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Permissions(PERMISSIONS.CMS_READ)
  list(@Query() query: MediaQueryDto) {
    return this.mediaService.list(query);
  }

  @Post('upload')
  @Permissions(PERMISSIONS.MEDIA_MANAGE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        altAr: { type: 'string' },
        altEn: { type: 'string' },
        title: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Image uploaded')
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadFile,
    @Body() body: { altAr?: string; altEn?: string; title?: string },
  ) {
    return this.mediaService.uploadToLibrary(file, MediaFolder.CMS, user.id, body);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.MEDIA_MANAGE)
  @ResponseMessage('Media updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateMediaAssetDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.MEDIA_MANAGE)
  @ResponseMessage('Media deleted')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.mediaService.remove(id);
  }
}
