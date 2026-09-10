import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ClientSession, FilterQuery, Model, Types } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { AccountType, Language } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { generateCardCode, toObjectId } from '../../common/utils/token.util';
import { UsersService } from '../users/users.service';
import { SequenceService } from '../../database/sequence.service';
import { MemberProfile, MemberProfileDocument } from './schemas/member-profile.schema';

/** End-of-day for an inclusive ISO date range bound. */
function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

export interface RegisterMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  language?: Language;
  primaryBranchId?: string;
}

export interface MemberListQuery {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  branchId?: string;
  status?: string;
  planId?: string;
  /** Subscription end-date range (ISO). */
  endFrom?: string;
  endTo?: string;
  /** Member join-date range (ISO). */
  joinedFrom?: string;
  joinedTo?: string;
}

@Injectable()
export class MembersService {
  private readonly codePrefix: string;

  constructor(
    @InjectModel(MemberProfile.name) private readonly memberModel: Model<MemberProfileDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
    private readonly sequence: SequenceService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.codePrefix = `${config.get('business.memberCodePrefix', { infer: true })}-`;
  }

  /** Random member code, e.g. "IRON-7K2Q9F" — 6 unambiguous alphanumerics after the prefix. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateMemberCode(_session?: ClientSession): Promise<string> {
    return `${this.codePrefix}${generateCardCode(6)}`;
  }

  /** Retries random generation until it yields a code no member currently holds. */
  private async allocateFreeMemberCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = await this.generateMemberCode();
      if (!(await this.memberModel.exists({ memberCode: code }))) return code;
    }
    throw new ConflictException('Could not allocate a unique member code');
  }

  /** Creates a User(MEMBER) + MemberProfile atomically. Used by self-registration and admin create. */
  async register(input: RegisterMemberInput): Promise<MemberProfileDocument> {
    if (await this.usersService.exists({ email: input.email.toLowerCase() })) {
      throw new ConflictException('An account with this email already exists');
    }

    // Resolve a free member code before opening the transaction (a write
    // collision inside a txn would abort it, so we can't retry there).
    const memberCode = await this.allocateFreeMemberCode();

    const session = await this.connection.startSession();
    try {
      let profileId!: Types.ObjectId;
      await session.withTransaction(async () => {
        const user = await this.usersService.create(
          {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            password: input.password,
            accountType: AccountType.MEMBER,
            language: input.language ?? Language.AR,
          },
          session,
        );
        const [profile] = await this.memberModel.create(
          [
            {
              user: user._id,
              memberCode,
              primaryBranch: input.primaryBranchId
                ? new Types.ObjectId(input.primaryBranchId)
                : null,
            },
          ],
          { session },
        );
        await this.usersService.linkProfile(user._id, 'memberProfile', profile._id, session);
        profileId = profile._id;
      });
      // Raw doc (user stays an ObjectId) — callers populate via getByIdOrFail when needed.
      const raw = await this.findRawById(profileId);
      if (!raw) throw new ConflictException('Member profile creation failed');
      return raw;
    } finally {
      await session.endSession();
    }
  }

  /** Front-desk member creation: login + profile, then optional profile fields. */
  async createByStaff(dto: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    primaryBranchId?: string;
    gender?: MemberProfileDocument['gender'];
    dateOfBirth?: string;
    dailyCheckInLimit?: number;
  }): Promise<MemberProfileDocument> {
    const raw = await this.register({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      primaryBranchId: dto.primaryBranchId,
    });
    if (dto.gender || dto.dateOfBirth || dto.dailyCheckInLimit !== undefined) {
      const profile = await this.memberModel.findById(raw._id).exec();
      if (profile) {
        await this.applyProfileUpdate(
          profile,
          {
            gender: dto.gender,
            dateOfBirth: dto.dateOfBirth,
            dailyCheckInLimit: dto.dailyCheckInLimit,
          },
          true,
        );
      }
    }
    return this.getByIdOrFail(raw._id);
  }

  findByUserId(userId: string | Types.ObjectId): Promise<MemberProfileDocument | null> {
    return this.memberModel
      .findOne({ user: toObjectId(userId) })
      .populate('user', 'firstName lastName email phone language isActive')
      .populate('primaryBranch', 'code nameAr nameEn')
      .exec();
  }

  async getByUserIdOrFail(userId: string | Types.ObjectId): Promise<MemberProfileDocument> {
    const doc = await this.findByUserId(userId);
    if (!doc) throw new NotFoundException('Member profile not found');
    return doc;
  }

  /** Resolve a printed / spoken member code (e.g. "IRON-000001") to its profile id. */
  async findIdByMemberCode(code: string): Promise<Types.ObjectId | null> {
    const doc = await this.memberModel
      .findOne({ memberCode: code.trim().toUpperCase() })
      .select('_id')
      .lean()
      .exec();
    return doc ? (doc._id as Types.ObjectId) : null;
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<MemberProfileDocument> {
    const doc = await this.memberModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Member not found');

    // Populate only refs that actually hold a valid ObjectId — legacy rows can
    // carry an empty string, which makes `.populate()` throw a CastError.
    const paths: Array<{ path: string; select: string }> = [
      { path: 'user', select: 'firstName lastName email phone language isActive lastLoginAt' },
    ];
    if (Types.ObjectId.isValid(doc.primaryBranch as Types.ObjectId)) {
      paths.push({ path: 'primaryBranch', select: 'code nameAr nameEn' });
    } else {
      doc.primaryBranch = null;
    }
    if (Types.ObjectId.isValid(doc.currentSubscription as Types.ObjectId)) {
      paths.push({
        path: 'currentSubscription',
        select:
          'planNameAr planNameEn status startDate endDate finalPrice paidAmount remainingAmount',
      });
    } else {
      doc.currentSubscription = null;
    }
    await doc.populate(paths);
    return doc;
  }

  findRawById(id: string | Types.ObjectId): Promise<MemberProfileDocument | null> {
    return this.memberModel.findById(id).exec();
  }

  async list(query: MemberListQuery): Promise<PaginatedResult<MemberProfileDocument>> {
    const filter: FilterQuery<MemberProfileDocument> = {};
    if (query.branchId) filter.primaryBranch = new Types.ObjectId(query.branchId);

    if (query.joinedFrom || query.joinedTo) {
      filter.joinDate = {};
      if (query.joinedFrom) (filter.joinDate as Record<string, Date>).$gte = new Date(query.joinedFrom);
      if (query.joinedTo) (filter.joinDate as Record<string, Date>).$lte = endOfDay(query.joinedTo);
    }

    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      const matchingUserIds = await this.usersService.findIdsByText(escaped);
      filter.$or = [{ memberCode: rx }, { user: { $in: matchingUserIds } }];
    }

    const needsSubJoin = Boolean(query.status || query.planId || query.endFrom || query.endTo);

    if (!needsSubJoin) {
      const [items, total] = await Promise.all([
        this.memberModel
          .find(filter)
          .populate('user', 'firstName lastName email phone isActive')
          .populate('primaryBranch', 'code nameAr nameEn')
          .populate(
            'currentSubscription',
            'planNameAr planNameEn status startDate endDate finalPrice paidAmount remainingAmount',
          )
          .sort(buildSort(query.sortBy, query.sortDir))
          .skip(query.skip)
          .limit(query.limit)
          .exec(),
        this.memberModel.countDocuments(filter).exec(),
      ]);
      return paginated(items, total, query.page, query.limit);
    }

    // ── Subscription-aware filtering via aggregation ──
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const csMatch: Record<string, unknown> = {};

    if (query.planId) csMatch['cs.plan'] = new Types.ObjectId(query.planId);
    if (query.endFrom || query.endTo) {
      const range: Record<string, Date> = {};
      if (query.endFrom) range.$gte = new Date(query.endFrom);
      if (query.endTo) range.$lte = endOfDay(query.endTo);
      csMatch['cs.endDate'] = range;
    }

    let statusMatch: Record<string, unknown> | null = null;
    switch (query.status) {
      case 'none':
        statusMatch = { $or: [{ cs: null }, { 'cs.status': 'CANCELLED' }] };
        break;
      case 'active':
        statusMatch = { 'cs.status': { $in: ['ACTIVE', 'EXPIRING_SOON'] }, 'cs.endDate': { $gt: now } };
        break;
      case 'expiring_soon':
        statusMatch = {
          'cs.status': { $in: ['ACTIVE', 'EXPIRING_SOON'] },
          'cs.endDate': { $gt: now, $lte: soon },
        };
        break;
      case 'expired':
        statusMatch = {
          $and: [
            { 'cs.status': { $ne: 'CANCELLED' } },
            { $or: [{ 'cs.status': 'EXPIRED' }, { 'cs.endDate': { $lte: now } }] },
          ],
        };
        break;
      case 'frozen':
        statusMatch = { 'cs.status': 'FROZEN' };
        break;
      case 'pending_payment':
        statusMatch = { 'cs.status': 'PENDING_PAYMENT' };
        break;
      case 'payment_under_review':
        statusMatch = { 'cs.status': 'PAYMENT_UNDER_REVIEW' };
        break;
      case 'outstanding':
        statusMatch = { 'cs.remainingAmount': { $gt: 0 } };
        break;
    }
    if (statusMatch) Object.assign(csMatch, statusMatch);

    const sort = buildSort(query.sortBy, query.sortDir) as Record<string, 1 | -1>;
    const pipeline: import('mongoose').PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'currentSubscription',
          foreignField: '_id',
          as: 'cs',
        },
      },
      { $addFields: { cs: { $arrayElemAt: ['$cs', 0] } } },
      { $match: csMatch },
      { $sort: Object.keys(sort).length ? sort : { createdAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: query.skip },
            { $limit: query.limit },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user',
              },
            },
            { $addFields: { user: { $arrayElemAt: ['$user', 0] } } },
            {
              $lookup: {
                from: 'branches',
                localField: 'primaryBranch',
                foreignField: '_id',
                as: 'primaryBranch',
              },
            },
            { $addFields: { primaryBranch: { $arrayElemAt: ['$primaryBranch', 0] } } },
            {
              $addFields: {
                currentSubscription: {
                  $cond: [
                    { $ifNull: ['$cs', false] },
                    {
                      _id: '$cs._id',
                      planNameAr: '$cs.planNameAr',
                      planNameEn: '$cs.planNameEn',
                      status: '$cs.status',
                      startDate: '$cs.startDate',
                      endDate: '$cs.endDate',
                      finalPrice: '$cs.finalPrice',
                      paidAmount: '$cs.paidAmount',
                      remainingAmount: '$cs.remainingAmount',
                    },
                    null,
                  ],
                },
              },
            },
            { $project: { cs: 0 } },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [res] = await this.memberModel.aggregate(pipeline).exec();
    const rows = (res?.rows ?? []) as MemberProfileDocument[];
    const total = (res?.total?.[0]?.n ?? 0) as number;
    return paginated(rows, total, query.page, query.limit);
  }

  private async applyProfileUpdate(
    profile: MemberProfileDocument,
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: MemberProfileDocument['gender'];
      primaryBranchId?: string;
      emergencyContact?: { name?: string; phone?: string; relation?: string };
      dailyCheckInLimit?: number;
    },
    staff = false,
  ): Promise<MemberProfileDocument> {
    if (staff && dto.dailyCheckInLimit !== undefined) {
      profile.dailyCheckInLimit = Math.max(0, Math.floor(dto.dailyCheckInLimit));
    }
    if (dto.dateOfBirth !== undefined) profile.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) profile.gender = dto.gender;
    if (dto.primaryBranchId !== undefined) {
      profile.primaryBranch = dto.primaryBranchId ? new Types.ObjectId(dto.primaryBranchId) : null;
    }
    if (dto.emergencyContact) {
      profile.emergencyContact = {
        name: dto.emergencyContact.name ?? profile.emergencyContact?.name ?? '',
        phone: dto.emergencyContact.phone ?? profile.emergencyContact?.phone ?? '',
        relation: dto.emergencyContact.relation ?? profile.emergencyContact?.relation ?? '',
      };
    }
    await profile.save();

    if (dto.firstName || dto.lastName || dto.phone) {
      const user = await this.usersService.getByIdOrFail(profile.user);
      if (dto.firstName) user.firstName = dto.firstName;
      if (dto.lastName) user.lastName = dto.lastName;
      if (dto.phone) user.phone = dto.phone;
      await user.save();
    }
    return this.getByIdOrFail(profile._id);
  }

  async updateSelf(
    userId: string | Types.ObjectId,
    dto: Parameters<MembersService['applyProfileUpdate']>[1],
  ): Promise<MemberProfileDocument> {
    const profile = await this.memberModel.findOne({ user: toObjectId(userId) }).exec();
    if (!profile) throw new NotFoundException('Member profile not found');
    return this.applyProfileUpdate(profile, dto);
  }

  async updateByProfileId(
    id: string | Types.ObjectId,
    dto: Parameters<MembersService['applyProfileUpdate']>[1],
  ): Promise<MemberProfileDocument> {
    const profile = await this.memberModel.findById(id).exec();
    if (!profile) throw new NotFoundException('Member not found');
    return this.applyProfileUpdate(profile, dto, true);
  }

  async setCurrentSubscription(
    memberId: string | Types.ObjectId,
    subscriptionId: Types.ObjectId | null,
    session?: ClientSession,
  ): Promise<void> {
    await this.memberModel
      .updateOne({ _id: memberId }, { $set: { currentSubscription: subscriptionId } }, { session })
      .exec();
  }

  async setQrEnabled(memberId: string | Types.ObjectId, enabled: boolean): Promise<void> {
    await this.memberModel.updateOne({ _id: memberId }, { $set: { qrEnabled: enabled } }).exec();
  }

  countAll(): Promise<number> {
    return this.memberModel.countDocuments().exec();
  }
}
