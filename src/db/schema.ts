/**
 * Every table keeps sync possible later: text UUID ids, updated_at on every
 * row, and soft deletes (deleted_at) instead of removing rows.
 *
 * After changing this file, run `npm run db:generate` to add a migration.
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Relative import: drizzle-kit loads this file without the app's path aliases.
import { LOOP_STATES } from '../domain/loop';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const loops = sqliteTable(
  'loops',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    state: text('state', { enum: LOOP_STATES }).notNull(),
    nextAction: text('next_action'),
    dueAt: timestamp('due_at'),
    waitingOn: text('waiting_on'),
    revisitAt: timestamp('revisit_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    decidedAt: timestamp('decided_at'),
    reviewedAt: timestamp('reviewed_at'),
    closedAt: timestamp('closed_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('loops_state_idx').on(table.state)],
);

/** One row per completed nightly close, to see whether the habit is sticking. */
export const dailyCloses = sqliteTable('daily_closes', {
  id: text('id').primaryKey(),
  /** Local calendar day of the close, as YYYY-MM-DD. */
  day: text('day').notNull(),
  resolvedCount: integer('resolved_count').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  deletedAt: timestamp('deleted_at'),
});

/** One row per weekly review; completed_at stays null while one is in progress. */
export const weeklyReviews = sqliteTable('weekly_reviews', {
  id: text('id').primaryKey(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  /** How many loops were kept, changed, finished, or dropped during the review. */
  reviewedCount: integer('reviewed_count'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

/**
 * AI suggestions for inbox loops, kept so they outlast the app closing. Only a
 * cache on this phone: never exported, restored, or synced, so it skips the
 * conventions above.
 */
export const aiSuggestions = sqliteTable('ai_suggestions', {
  loopId: text('loop_id').primaryKey(),
  /** The suggestion as the model wrote it, checked again whenever it's read (parseSuggestion). */
  answer: text('answer').notNull(),
  /** The loop's updated_at it was suggested for: an edited loop gets no stale suggestion. */
  loopUpdatedAt: timestamp('loop_updated_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
