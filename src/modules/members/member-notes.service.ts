import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemberNote, MemberNoteDocument } from './schemas/member-note.schema';

@Injectable()
export class MemberNotesService {
  constructor(
    @InjectModel(MemberNote.name) private readonly noteModel: Model<MemberNoteDocument>,
  ) {}

  list(memberId: string): Promise<MemberNoteDocument[]> {
    return this.noteModel
      .find({ member: new Types.ObjectId(memberId) })
      .sort({ pinned: -1, createdAt: -1 })
      .exec();
  }

  create(
    memberId: string,
    body: string,
    author: { id: string; label: string },
    pinned = false,
  ): Promise<MemberNoteDocument> {
    return this.noteModel.create({
      member: new Types.ObjectId(memberId),
      body,
      pinned,
      createdBy: new Types.ObjectId(author.id),
      createdByLabel: author.label,
    });
  }

  async update(
    noteId: string,
    patch: { body?: string; pinned?: boolean },
  ): Promise<MemberNoteDocument> {
    const note = await this.noteModel.findById(noteId).exec();
    if (!note) throw new NotFoundException('Note not found');
    if (patch.body !== undefined) note.body = patch.body;
    if (patch.pinned !== undefined) note.pinned = patch.pinned;
    await note.save();
    return note;
  }

  async remove(noteId: string, requesterId: string, isPrivileged: boolean): Promise<void> {
    const note = await this.noteModel.findById(noteId).exec();
    if (!note) throw new NotFoundException('Note not found');
    if (!isPrivileged && String(note.createdBy) !== requesterId) {
      throw new ForbiddenException('You can only delete your own notes');
    }
    await note.deleteOne();
  }
}
