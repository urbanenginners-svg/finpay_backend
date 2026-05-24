import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Permission } from "../mongoose/schemas/permission.schema";
import { Role } from "../mongoose/schemas/role.schema";
import { Model } from "mongoose";
import { User } from "../mongoose/schemas/user.schema";
import { AppAbility } from "./types";
import { PermissionEnum } from "src/utils/enums/permission.enum";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

@Injectable()
export class CaslAbilityFactory {
  constructor(
    @InjectModel(Permission.name) private permissionModel: Model<Permission>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
  ) {}

  async createForUser(user: User): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder(createMongoAbility);
    if (!user.role) {
      return build() as AppAbility;
    }

    // Find the user's role with populated permissions
    const roleId = typeof user.role === 'object' && (user.role as any)._id ? (user.role as any)._id : user.role;
    const userRoles = await this.roleModel
      .find({ _id: roleId, isActive: { $ne: false } })
      .populate('permissions')
      .exec();

    if (!userRoles || userRoles.length === 0) {
      return build() as AppAbility;
    }

    // Process the role and its permissions
    userRoles.forEach((userRole) => {
      if (!userRole.permissions) return;

      userRole.permissions.forEach((permission: any) => {
        let action: PermissionEnum;
        switch (permission.action) {
          case PermissionEnum.READ:
            action = PermissionEnum.READ;
            break;
          case PermissionEnum.WRITE:
            action = PermissionEnum.WRITE;
            break;
          case PermissionEnum.UPDATE:
            action = PermissionEnum.UPDATE;
            break;
          case PermissionEnum.DELETE:
            action = PermissionEnum.DELETE;
            break;
          default:
            return; // Skip unknown actions
        }

        // Grant the permission for the resource
        can(action, permission.resource);
      });
    });

    return build() as AppAbility;
  }

  // Helper method to check if user has specific permission
  async hasPermission(
    user: User,
    action: PermissionEnum,
    resource: string,
  ): Promise<boolean> {
    const ability = await this.createForUser(user);
    return ability.can(action, resource);
  }

  // Helper method to get all user permissions as strings
  async getUserPermissions(user: User): Promise<string[]> {
    if (!user.role) {
      return [];
    }

    const roleId = typeof user.role === 'object' && (user.role as any)._id ? (user.role as any)._id : user.role;
    const userRoles = await this.roleModel
      .find({ _id: roleId, isActive: { $ne: false } })
      .populate('permissions')
      .exec();

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const slugs: string[] = [];
    userRoles.forEach((userRole) => {
      if (!userRole.permissions) return;
      userRole.permissions.forEach((permission: any) => {
        slugs.push(permission.slug);
      });
    });
    return slugs;
  }
}
