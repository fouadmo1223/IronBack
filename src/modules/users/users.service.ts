import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import { AccountType, Language } from '../../common/enums';
import { hashPassword } from '../../common/utils/password.util';
import { User, UserDocument } from './schemas/user.schema';

interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  accountType: AccountType;
  language?: Language;
  isVerified?: boolean;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(input: CreateUserInput, session?: ClientSession): Promise<UserDocument> {
    const passwordHash = await hashPassword(input.password);
    const [doc] = await this.userModel.create(
      [
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase().trim(),
          phone: input.phone.trim(),
          passwordHash,
          accountType: input.accountType,
          language: input.language ?? Language.AR,
          isVerified: input.isVerified ?? false,
        },
      ],
      { session },
    );
    return doc;
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIdWithPassword(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+passwordHash').exec();
  }

  exists(filter: FilterQuery<UserDocument>): Promise<boolean> {
    return this.userModel.exists(filter).then((r) => !!r);
  }

  /** Ids of users whose name / email / phone match a (pre-escaped) search fragment. */
  async findIdsByText(escaped: string): Promise<Types.ObjectId[]> {
    const rx = new RegExp(escaped, 'i');
    const rows = await this.userModel
      .find({ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }] })
      .select('_id')
      .lean()
      .exec();
    return rows.map((r) => r._id);
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setPassword(
    id: string | Types.ObjectId,
    newPassword: string,
    session?: ClientSession,
  ): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    await this.userModel.updateOne({ _id: id }, { $set: { passwordHash } }, { session }).exec();
  }

  async markLogin(id: string | Types.ObjectId): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  }

  async setActive(id: string | Types.ObjectId, isActive: boolean): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { $set: { isActive } }).exec();
  }

  async linkProfile(
    id: string | Types.ObjectId,
    field: 'staffProfile' | 'memberProfile',
    profileId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $set: { [field]: profileId } }, { session })
      .exec();
  }
}
