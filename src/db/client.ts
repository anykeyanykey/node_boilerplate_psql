import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import type { Config } from '../config.js';
import { createPool } from './pool.js';

export type Database = NodePgDatabase & { $client: Pool };

export interface DatabaseHandle {
  pool: Pool;
  db: Database;
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase(config: Config, logger: Logger): DatabaseHandle {
  const pool = createPool(config, logger);
  const db = drizzle({ client: pool });

  return {
    pool,
    db,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: async () => {
      await pool.end();
    },
  };
}
