import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { Branch, BranchDocument } from './schemas/branch.schema';

@Injectable()
export class BranchesService {
  constructor(@InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>) {}

  findAll(includeInactive = true): Promise<BranchDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.branchModel.find(filter).sort({ isPrimary: -1, nameEn: 1 }).exec();
  }

  findById(id: string | Types.ObjectId): Promise<BranchDocument | null> {
    return this.branchModel.findById(id).exec();
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<BranchDocument> {
    const branch = await this.findById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async getPrimary(): Promise<BranchDocument | null> {
    return (
      (await this.branchModel.findOne({ isPrimary: true }).exec()) ??
      (await this.branchModel.findOne({ isActive: true }).sort({ createdAt: 1 }).exec())
    );
  }

  async create(dto: CreateBranchDto): Promise<BranchDocument> {
    const code = dto.code.toUpperCase().trim();
    if (await this.branchModel.exists({ code })) {
      throw new BadRequestException(`Branch code "${code}" already exists`);
    }
    if (dto.isPrimary) await this.branchModel.updateMany({}, { $set: { isPrimary: false } }).exec();
    return this.branchModel.create({ ...dto, code });
  }

  async update(id: string | Types.ObjectId, dto: UpdateBranchDto): Promise<BranchDocument> {
    const branch = await this.getByIdOrFail(id);
    if (dto.isPrimary) {
      await this.branchModel.updateMany({ _id: { $ne: branch._id } }, { $set: { isPrimary: false } }).exec();
    }
    Object.assign(branch, dto, dto.code ? { code: dto.code.toUpperCase() } : {});
    await branch.save();
    return branch;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const branch = await this.getByIdOrFail(id);
    branch.isActive = false;
    await branch.save();
  }
}
