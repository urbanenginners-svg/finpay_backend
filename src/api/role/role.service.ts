import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Role,
  RoleDocument,
} from 'src/services/mongoose/schemas/role.schema';
import {
  Permission,
  PermissionDocument,
} from 'src/services/mongoose/schemas/permission.schema';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { getPaginatedDataWithAggregation } from 'src/utils/services/get-paginated-data-aggregation.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';


@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
  ) {}

  async findAll(
    query: CommonFieldsDto,
  ): Promise<{ data: RoleDocument[]; meta: any }> {
    const matchStage: Record<string, any> = {};

    if (query.q) {
      matchStage.name = { $regex: query.q, $options: 'i' };
    }

    if (query.isActive === true) {
      matchStage.$or = [{ isActive: true }, { isActive: { $exists: false } }];
    } else if (query.isActive === false) {
      matchStage.isActive = false;
    }

    const [data, meta] = await getPaginatedDataWithAggregation(
      this.roleModel,
      query,
      [{ $match: matchStage }],
    );
    return { data, meta };
  }

  async findOne(id: string): Promise<RoleDocument> {
    const role = await this.roleModel.findOne({ _id: id }).populate('permissions').exec();

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async findAllPermissions(
    query: CommonFieldsDto,
  ): Promise<{ data: PermissionDocument[]; meta: any }> {
    const matchStage: Record<string, any> = {};

    if (query.q) {
      matchStage.$or = [
        { slug: { $regex: query.q, $options: 'i' } },
        { resource: { $regex: query.q, $options: 'i' } },
        { action: { $regex: query.q, $options: 'i' } },
      ];
    }

    const [data, meta] = await getPaginatedDataWithAggregation(
      this.permissionModel,
      query,
      [{ $match: matchStage }],
    );
    return { data, meta };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    let slug = base;
    let counter = 1;
    while (await this.roleModel.exists({ slug })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  async create(createRoleDto: CreateRoleDto): Promise<RoleDocument> {
    const slug = await this.generateUniqueSlug(createRoleDto.name);
    const role = new this.roleModel({ ...createRoleDto, slug });
    return role.save();
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<RoleDocument> {
    await this.findOne(id);

    const updateData: Record<string, any> = {};
    if (updateRoleDto.description !== undefined) {
      updateData.description = updateRoleDto.description;
    }
    if (updateRoleDto.permissions !== undefined) {
      updateData.permissions = updateRoleDto.permissions;
    }

    const updated = await this.roleModel
      .findOneAndUpdate({ _id: id }, { $set: updateData }, { new: true })
      .populate('permissions')
      .exec();

    return updated;
  }

  async setActive(id: string, isActive: boolean): Promise<RoleDocument> {
    await this.findOne(id);

    const updated = await this.roleModel
      .findOneAndUpdate({ _id: id }, { $set: { isActive } }, { new: true })
      .populate('permissions')
      .exec();

    return updated;
  }

  async toggle(id: string): Promise<RoleDocument> {
    const role = await this.findOne(id);
    const nextActive = role.isActive === false;
    return this.setActive(id, nextActive);
  }
}
