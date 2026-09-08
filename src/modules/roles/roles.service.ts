import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ALL_PERMISSIONS } from '../../common/constants/permissions';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { Role, RoleDocument } from './schemas/role.schema';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>) {}

  findAll(): Promise<RoleDocument[]> {
    return this.roleModel.find().sort({ isSystem: -1, nameEn: 1 }).exec();
  }

  listPermissionCatalog(): string[] {
    return [...ALL_PERMISSIONS];
  }

  findById(id: string | Types.ObjectId): Promise<RoleDocument | null> {
    return this.roleModel.findById(id).exec();
  }

  findByKey(key: string): Promise<RoleDocument | null> {
    return this.roleModel.findOne({ key: key.toUpperCase() }).exec();
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<RoleDocument> {
    const role = await this.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto): Promise<RoleDocument> {
    const key = dto.key.toUpperCase().trim();
    if (await this.roleModel.exists({ key })) {
      throw new BadRequestException(`Role "${key}" already exists`);
    }
    return this.roleModel.create({ ...dto, key });
  }

  async update(id: string | Types.ObjectId, dto: UpdateRoleDto): Promise<RoleDocument> {
    const role = await this.getByIdOrFail(id);
    if (role.isSystem && dto.key && dto.key.toUpperCase() !== role.key) {
      throw new ForbiddenException('Cannot rename the key of a system role');
    }
    Object.assign(role, dto, dto.key ? { key: dto.key.toUpperCase() } : {});
    await role.save();
    return role;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const role = await this.getByIdOrFail(id);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    await role.deleteOne();
  }
}
