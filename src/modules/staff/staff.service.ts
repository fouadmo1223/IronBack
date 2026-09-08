import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AccountType } from '../../common/enums';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/types';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { CreateStaffDto, QueryStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffProfile, StaffProfileDocument } from './schemas/staff-profile.schema';

export interface ResolvedStaffContext {
  roleId: string;
  roleKey: string;
  permissions: string[];
  branchId?: string;
  isActive: boolean;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(StaffProfile.name) private readonly staffModel: Model<StaffProfileDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  /** Used by JwtStrategy to hydrate a staff principal's permissions. */
  async resolveContextByUserId(userId: string | Types.ObjectId): Promise<ResolvedStaffContext | null> {
    const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const profile = await this.staffModel.findOne({ user: uid }).lean().exec();
    if (!profile) return null;
    const role = await this.rolesService.findById(profile.role);
    if (!role) return null;
    return {
      roleId: String(profile.role),
      roleKey: role.key,
      permissions: role.permissions,
      branchId: profile.branch ? String(profile.branch) : undefined,
      isActive: profile.isActive && role.isActive,
    };
  }

  async list(query: QueryStaffDto): Promise<PaginatedResult<StaffProfileDocument>> {
    const filter: FilterQuery<StaffProfileDocument> = {};
    if (query.branchId) filter.branch = new Types.ObjectId(query.branchId);
    if (query.roleId) filter.role = new Types.ObjectId(query.roleId);

    const [items, total] = await Promise.all([
      this.staffModel
        .find(filter)
        .populate('user', 'firstName lastName email phone isActive lastLoginAt')
        .populate('role', 'key nameAr nameEn')
        .populate('branch', 'code nameAr nameEn')
        .sort(buildSort(query.sortBy, query.sortDir))
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.staffModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<StaffProfileDocument> {
    const doc = await this.staffModel
      .findById(id)
      .populate('user', 'firstName lastName email phone isActive lastLoginAt')
      .populate('role', 'key nameAr nameEn permissions')
      .populate('branch', 'code nameAr nameEn')
      .exec();
    if (!doc) throw new NotFoundException('Staff member not found');
    return doc;
  }

  async create(dto: CreateStaffDto): Promise<StaffProfileDocument> {
    await this.rolesService.getByIdOrFail(dto.roleId);
    if (await this.usersService.exists({ email: dto.email.toLowerCase() })) {
      throw new BadRequestException('A user with this email already exists');
    }

    const session = await this.connection.startSession();
    try {
      let profileId!: Types.ObjectId;
      await session.withTransaction(async () => {
        const user = await this.usersService.create(
          {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            password: dto.password,
            accountType: AccountType.STAFF,
            isVerified: true,
          },
          session,
        );
        const [profile] = await this.staffModel.create(
          [
            {
              user: user._id,
              role: new Types.ObjectId(dto.roleId),
              branch: dto.branchId ? new Types.ObjectId(dto.branchId) : null,
              jobTitleAr: dto.jobTitleAr ?? '',
              jobTitleEn: dto.jobTitleEn ?? '',
            },
          ],
          { session },
        );
        await this.usersService.linkProfile(user._id, 'staffProfile', profile._id, session);
        profileId = profile._id;
      });
      return this.getByIdOrFail(profileId);
    } finally {
      await session.endSession();
    }
  }

  async update(id: string | Types.ObjectId, dto: UpdateStaffDto): Promise<StaffProfileDocument> {
    const profile = await this.staffModel.findById(id).exec();
    if (!profile) throw new NotFoundException('Staff member not found');

    if (dto.roleId) {
      await this.rolesService.getByIdOrFail(dto.roleId);
      profile.role = new Types.ObjectId(dto.roleId);
    }
    if (dto.branchId !== undefined) {
      profile.branch = dto.branchId ? new Types.ObjectId(dto.branchId) : null;
    }
    if (dto.jobTitleAr !== undefined) profile.jobTitleAr = dto.jobTitleAr;
    if (dto.jobTitleEn !== undefined) profile.jobTitleEn = dto.jobTitleEn;
    if (dto.isActive !== undefined) {
      profile.isActive = dto.isActive;
      await this.usersService.setActive(profile.user, dto.isActive);
    }
    await profile.save();

    if (dto.firstName || dto.lastName || dto.phone) {
      const user = await this.usersService.getByIdOrFail(profile.user);
      if (dto.firstName) user.firstName = dto.firstName;
      if (dto.lastName) user.lastName = dto.lastName;
      if (dto.phone) user.phone = dto.phone;
      await user.save();
    }
    return this.getByIdOrFail(id);
  }

  async deactivate(id: string | Types.ObjectId): Promise<void> {
    const profile = await this.staffModel.findById(id).exec();
    if (!profile) throw new NotFoundException('Staff member not found');
    profile.isActive = false;
    await profile.save();
    await this.usersService.setActive(profile.user, false);
  }
}
