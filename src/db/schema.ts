/**
 * Table definitions for Drizzle.
 *
 * Drizzle derives its types from these declarations, so a table added here is
 * immediately visible to `db.select().from(...)` with no codegen step and no
 * generated client.
 *
 * ```ts
 * import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
 *
 * export const users = pgTable('users', {
 *   id: uuid('id').primaryKey().defaultRandom(),
 *   name: text('name').notNull(),
 *   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
 * });
 * ```
 *
 * This file is intentionally empty: the boilerplate ships the database
 * toolchain, not a domain model. Add tables here, then generate a migration
 * with `npm run db:generate`. Until then it reports "0 tables / nothing to
 * migrate", which is expected, not an error.
 *
 * Generated SQL lands in `drizzle/` and is committed. CI fails if a schema
 * change is not accompanied by its migration.
 */
export {};
