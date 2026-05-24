import mongoose from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { SystemApiKey, SystemApiKeySchema } from '../schemas/system-api-key.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Role, RoleSchema } from '../schemas/role.schema';

const SystemApiKeyModel = mongoose.model(SystemApiKey.name, SystemApiKeySchema);
const UserModel = mongoose.model(User.name, UserSchema);
const RoleModel = mongoose.model(Role.name, RoleSchema);

const API_SERVICE_USER_ID = 'api-service-admin';

async function ensureApiServiceUser(): Promise<void> {
  const exists = await UserModel.findOne({ _id: API_SERVICE_USER_ID });
  if (exists) {
    console.log('  ⚠  API service user already exists — skipping');
    return;
  }

  const role = await RoleModel.findOne({ name: 'Super Admin' });
  if (!role) {
    throw new Error('Super Admin role not found — run role seed first');
  }

  const hashedPassword = await bcrypt.hash('ApiService@123', 10);
  await UserModel.create({
    _id:         API_SERVICE_USER_ID,
    firstName:   'API',
    lastName:    'Service',
    email:       'api-service@sbzee.com',
    phoneNumber: '+0000000000',
    password:    hashedPassword,
    role:        role._id,
    isActive:    true,
  });

  console.log(`  ✓  API service user created (id: ${API_SERVICE_USER_ID})`);
}

export async function up(): Promise<void> {
  await ensureApiServiceUser();

  const existing = await SystemApiKeyModel.findOne({ name: 'ctrl-rest integration' });
  if (existing) {
    console.log('  ⚠  System API key already exists — skipping creation');
    console.log(`     publicKey     : ${existing.publicKey}`);
    console.log(`     linkedUserId  : ${existing.linkedUserId}`);
    console.log('     secretKey     : (not shown — was printed only on first creation)');
    return;
  }

  const publicKey   = 'ctrlpub_' + crypto.randomBytes(16).toString('hex');
  const plainSecret = 'ctrlsec_' + crypto.randomBytes(32).toString('hex');
  const secretHash  = await bcrypt.hash(plainSecret, 12);

  await SystemApiKeyModel.create({
    publicKey,
    secretHash,
    plainSecret,
    isActive:     true,
    expiresAt:    null,
    name:         'ctrl-rest integration',
    linkedUserId: API_SERVICE_USER_ID,
  });

  console.log('  ✓  System API key created');
  console.log(`     x-api-public-key : ${publicKey}`);
  console.log(`     x-api-secret-key : ${plainSecret}`);
  console.log(`     linkedUserId     : ${API_SERVICE_USER_ID}`);
  console.log('     ⚠  Copy the secret key now — it will NOT be shown again.');
}

export async function down(): Promise<void> {
  await SystemApiKeyModel.deleteMany({ name: 'ctrl-rest integration' });
  await UserModel.deleteMany({ _id: API_SERVICE_USER_ID });
  console.log('  ✓  System API key and API service user removed');
}
