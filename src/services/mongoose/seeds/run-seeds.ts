import type { Connection } from 'mongoose';

import * as seedPermission from './seedPermission';
import * as seedRoles from './seedRoles';
import * as seedUsers from './seedUsers';
import * as seedSystemApiKey from './seedSystemApiKey';

/** Runs permission, role, user, and system API key seeds against the active connection. */
export async function runDatabaseSeeds(connection: Connection): Promise<void> {
  await seedPermission.up(connection);
  await seedRoles.up();
  await seedUsers.up();
  await seedSystemApiKey.up();
}
