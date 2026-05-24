import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { runDatabaseSeeds } from 'src/services/mongoose/seeds/run-seeds';

@Injectable()
export class SeedService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run(): Promise<void> {
    await runDatabaseSeeds(this.connection);
  }
}
