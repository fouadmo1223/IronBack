import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { MemberNotesController } from './member-notes.controller';
import { MemberNotesService } from './member-notes.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberNote, MemberNoteSchema } from './schemas/member-note.schema';
import { MemberProfile, MemberProfileSchema } from './schemas/member-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemberProfile.name, schema: MemberProfileSchema },
      { name: MemberNote.name, schema: MemberNoteSchema },
    ]),
    UsersModule,
  ],
  controllers: [MembersController, MemberNotesController],
  providers: [MembersService, MemberNotesService],
  exports: [MembersService, MongooseModule],
})
export class MembersModule {}
