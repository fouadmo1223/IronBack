import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import {
  CurrentUser,
  ParseObjectIdPipe,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser } from '../../common/types';
import { MemberNotesService } from './member-notes.service';

class CreateNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

class UpdateNoteDto {
  @IsOptional() @IsString() @MinLength(1) body?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}

@ApiTags('Members')
@ApiBearerAuth()
@Controller('members/:memberId/notes')
export class MemberNotesController {
  constructor(private readonly notesService: MemberNotesService) {}

  @Get()
  @Permissions(PERMISSIONS.MEMBER_READ)
  list(@Param('memberId', ParseObjectIdPipe) memberId: string) {
    return this.notesService.list(memberId);
  }

  @Post()
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Note added')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseObjectIdPipe) memberId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(
      memberId,
      dto.body,
      { id: user.id, label: `${user.firstName} ${user.lastName}`.trim() },
      dto.pinned,
    );
  }

  @Patch(':noteId')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Note updated')
  update(
    @Param('noteId', ParseObjectIdPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(noteId, dto);
  }

  @Delete(':noteId')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Note deleted')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId', ParseObjectIdPipe) noteId: string,
  ) {
    await this.notesService.remove(noteId, user.id, user.roleKey === 'SUPER_ADMIN' || user.roleKey === 'ADMIN');
    return null;
  }
}
