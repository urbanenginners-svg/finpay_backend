import mongoose from 'mongoose';
import { roles } from './roles';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Permission, PermissionSchema } from '../schemas/permission.schema';

const RoleModel = mongoose.model(Role.name, RoleSchema);
const PermissionModel = mongoose.model(Permission.name, PermissionSchema);

export async function up(): Promise<void> {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);

  // Process all roles in parallel
  const rolePromises = roles.map(async (role) => {
    // Get permission IDs from permission slugs in parallel
    const permissionPromises = role.permissions.map(async (permissionSlug) => {
      const permission = await PermissionModel.findOne({
        slug: permissionSlug,
      });
      if (permission) {
        return permission._id;
      } else {
        console.warn(
          `Permission with slug '${permissionSlug}' not found for role '${role.name}'`,
        );
        return null;
      }
    });

    const permissionResults = await Promise.all(permissionPromises);
    const permissionIds = permissionResults.filter((id) => id !== null);

    // Prepare role data with permission IDs instead of slugs
    const roleData = {
      name: role.name,
      slug: role.slug,
      description: role.description,
      permissions: permissionIds,
    };

    const existingRole = await RoleModel.findOne({ name: role.name });
    if (!existingRole) {
      await RoleModel.create(roleData);
      console.log(
        `Created role: ${role.name} with ${permissionIds.length} permissions`,
      );
    } else {
      await RoleModel.updateOne({ name: role.name }, roleData);
      console.log(
        `Updated role: ${role.name} with ${permissionIds.length} permissions`,
      );
    }
  });

  await Promise.all(rolePromises);
}

export async function down(): Promise<void> {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
  await RoleModel.deleteMany({});
}
