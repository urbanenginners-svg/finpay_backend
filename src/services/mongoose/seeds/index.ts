import { config } from 'dotenv';
import mongoose from 'mongoose';

import { runDatabaseSeeds } from './run-seeds';

// Load environment variables from .env file
config();

async function runSeeds() {
  try {
    console.log('🌱 Starting database seeding...\n');

    const mongoUri = process.env.MONGO_CONNECTION_STRING;
    if (!mongoUri) {
      throw new Error('MONGO_CONNECTION_STRING is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');

    console.log('═══════════════════════════════════════');
    console.log('Running database seeds...');
    console.log('═══════════════════════════════════════');
    await runDatabaseSeeds(mongoose.connection);
    console.log('');

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ MongoDB connection closed');
    process.exit(0);
  }
}

runSeeds();
