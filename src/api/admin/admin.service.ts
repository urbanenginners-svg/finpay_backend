import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from 'src/services/mongoose/schemas/user.schema';
import { Role } from 'src/services/mongoose/schemas/role.schema';
import { CreateUserDto, GetUsersQueryDto, UpdateUserDto } from './dto';
import { getPaginatedDataWithAggregation } from 'src/utils/services/get-paginated-data-aggregation.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async validateRole(roleId: string): Promise<void> {
    if (!roleId) {
      throw new BadRequestException('A role ID must be provided');
    }

    const foundRole = await this.roleModel
      .findOne({ _id: roleId, deletedAt: null, isActive: { $ne: false } })
      .exec();

    if (!foundRole) {
      throw new BadRequestException(
        `Role with ID '${roleId}' does not exist`,
      );
    }
  }

  // ─── Create User ──────────────────────────────────────────────────────────

  async create(createUserDto: CreateUserDto, requestUserId?: string): Promise<UserDocument> {
    const { password, role, email, phoneNumber, ...rest } = createUserDto;

    // Validate role exists
    await this.validateRole(role);

    // Check for duplicate email
    const existingEmail = await this.userModel.findOne({ email }).exec();
    if (existingEmail) {
      throw new ConflictException(`A user with email '${email}' already exists`);
    }

    // Check for duplicate phone number (only if provided)
    if (phoneNumber) {
      const existingPhone = await this.userModel
        .findOne({ phoneNumber })
        .exec();
      if (existingPhone) {
        throw new ConflictException(
          `A user with phone number '${phoneNumber}' already exists`,
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      ...rest,
      email,
      ...(phoneNumber && { phoneNumber }),
      password: hashedPassword,
      role: role,
      isActive: true,
      ...(requestUserId && { createdBy: requestUserId }),
    };

    const user = new this.userModel(userData);
    return user.save();
  }

  // ─── Find All Users ───────────────────────────────────────────────────────

  async findAll(
    query: GetUsersQueryDto,
  ): Promise<{ data: any[]; meta: any }> {
    const { roleId, roleName, isActive } = query;

    const matchStage: Record<string, any> = { deletedAt: null };

    if (roleId) {
      matchStage['role'] = roleId;
    }

    if (isActive !== undefined) {
      matchStage['isActive'] = isActive;
    }

    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q) {
      const searchRegex = { $regex: q, $options: 'i' };
      matchStage['$or'] = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
              regex: q,
              options: 'i',
            },
          },
        },
      ];
    }

    const aggregationPipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'role',
        },
      },
      {
        $unwind: { path: '$role', preserveNullAndEmptyArrays: true },
      },
      ...(roleName
        ? [
            {
              $match: {
                $or: [
                  { 'role.name': { $regex: roleName, $options: 'i' } },
                  { 'role.slug': { $regex: roleName, $options: 'i' } },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          __v: 0,
          password: 0,
          keywords: 0,
        },
      },
    ];

    const [data, meta] = await getPaginatedDataWithAggregation(
      this.userModel,
      query,
      aggregationPipeline,
    );

    return { data, meta };
  }

  // ─── Find One User ────────────────────────────────────────────────────────

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .populate('role')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  // ─── Update User ──────────────────────────────────────────────────────────

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requestUserId?: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);

    const { role, password, ...rest } = updateUserDto;

    // Validate role if provided
    if (role) {
      await this.validateRole(role);
    }

    // Check duplicate email if being changed
    if (rest.email && rest.email !== user.email) {
      const existingEmail = await this.userModel
        .findOne({ email: rest.email })
        .exec();
      if (existingEmail) {
        throw new ConflictException(
          `A user with email '${rest.email}' already exists`,
        );
      }
    }

    // Check duplicate phone number if being changed
    if (rest.phoneNumber && rest.phoneNumber !== user.phoneNumber) {
      const existingPhone = await this.userModel
        .findOne({ phoneNumber: rest.phoneNumber })
        .exec();
      if (existingPhone) {
        throw new ConflictException(
          `A user with phone number '${rest.phoneNumber}' already exists`,
        );
      }
    }

    const updateData: Record<string, any> = {
      ...rest,
      ...(requestUserId && { lastUpdatedBy: requestUserId }),
    };

    if (role) {
      updateData.role = role;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    Object.assign(user, updateData);
    return user.save();
  }

  // ─── Delete User (Soft) ───────────────────────────────────────────────────

  async remove(id: string, requestUserId?: string): Promise<UserDocument> {
    const user = await this.findOne(id);

    user.deletedAt = new Date();
    if (requestUserId) {
      user.deletedBy = requestUserId;
    }

    return user.save();
  }
}
