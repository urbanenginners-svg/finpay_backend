import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { users } from './users';
import { User, UserSchema } from '../schemas/user.schema';
import { Role, RoleSchema } from '../schemas/role.schema';

const UserModel = mongoose.model(User.name, UserSchema);
const RoleModel = mongoose.model(Role.name, RoleSchema);

export async function up(): Promise<void> {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);

  // Process all users in parallel
  const userPromises = users.map(async (user) => {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(user.password, saltRounds);

    // Get role ID from role name
    const roleDoc = await RoleModel.findOne({ name: user.role });
    let roleId: string | null = null;
    if (roleDoc) {
      roleId = roleDoc._id as string;
    } else {
      console.warn(
        `Role with name '${user.role}' not found for user '${user.email}'`,
      );
    }

    // Prepare user data with role ID instead of role name
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      password: hashedPassword,
      role: roleId,
    };

    const existingUser = await UserModel.findOne({ email: user.email });
    if (!existingUser) {
      await UserModel.create(userData);
      console.log(
        `Created user: ${user.email} with role '${user.role}'`,
      );
    } else {
      await UserModel.updateOne({ email: user.email }, userData);
      console.log(
        `Updated user: ${user.email} with role '${user.role}'`,
      );
    }
  });

  await Promise.all(userPromises);
}

export async function down(): Promise<void> {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
  await UserModel.deleteMany({});
}
