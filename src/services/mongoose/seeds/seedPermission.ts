// Import your schemas here

import mongoose from 'mongoose';
import type { Connection } from 'mongoose'
import { Permission, PermissionSchema } from '../schemas/permission.schema';
import { permissions } from './permissions';

const PermissionModel = mongoose.model(Permission.name, PermissionSchema);

export async function up (connection: Connection): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
    }

    console.log('Starting permission seeding...');
    let createdCount = 0;
    let existingCount = 0;

    // Create permissions if they don't exist (based on slug)
    for (const permissionData of permissions) {
      const existingPermission = await PermissionModel.findOne({ slug: permissionData.slug });
      
      if (!existingPermission) {
        const permission = new PermissionModel(permissionData);
        await permission.save();
        console.log(`✓ Created permission: ${permissionData.slug}`);
        createdCount++;
      } else {
        console.log(`- Permission already exists: ${permissionData.slug}`);
        existingCount++;
      }
    }
    
    console.log(`Permission seeding completed. Created: ${createdCount}, Existing: ${existingCount}, Total: ${permissions.length}`);
  } catch (error) {
    console.error('Error during permission seeding:', error);
    throw error;
  }
}

export async function down (connection: Connection): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
    }

    console.log('Starting permission cleanup...');
    
    // Remove all permissions with matching slugs
    const slugsToRemove = permissions.map(p => p.slug);
    const result = await PermissionModel.deleteMany({ slug: { $in: slugsToRemove } });
    
    console.log(`✓ Removed ${result.deletedCount} seeded permissions`);
  } catch (error) {
    console.error('Error during permission cleanup:', error);
    throw error;
  }
}
