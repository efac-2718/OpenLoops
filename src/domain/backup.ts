/**
 * Restoring from a JSON backup made by Export. A restore merges, it never
 * deletes: anything only in the backup is added, and where both sides have
 * the same row the one changed more recently wins. That makes a restore safe
 * to repeat, and it is the same rule sync will need.
 */

import { EXPORT_FORMAT_VERSION, type ExportData } from './export';
import { LOOP_STATES, type Loop, type Result } from './loop';

export type BackupError = 'not_json' | 'not_open_loops' | 'newer_version' | 'invalid';

export type Backup = ExportData & { exportedAt: Date | null };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class InvalidBackup extends Error {}

function date(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) throw new InvalidBackup();
  return parsed;
}

const optionalDate = (value: unknown) => (value == null ? null : date(value));

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new InvalidBackup();
  return value;
}

const optionalText = (value: unknown) => (value == null ? null : text(value));

function list(value: unknown): Json[] {
  if (value == null) return []; // Backups from older versions lack newer lists.
  if (!Array.isArray(value) || !value.every(isObject)) throw new InvalidBackup();
  return value;
}

function toLoop(row: Json): Loop {
  const state = row.state;
  if (!LOOP_STATES.includes(state as Loop['state'])) throw new InvalidBackup();
  return {
    id: text(row.id),
    title: text(row.title),
    notes: optionalText(row.notes),
    state: state as Loop['state'],
    nextAction: optionalText(row.nextAction),
    dueAt: optionalDate(row.dueAt),
    waitingOn: optionalText(row.waitingOn),
    revisitAt: optionalDate(row.revisitAt),
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
    decidedAt: optionalDate(row.decidedAt),
    reviewedAt: optionalDate(row.reviewedAt),
    closedAt: optionalDate(row.closedAt),
    deletedAt: optionalDate(row.deletedAt),
  };
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new InvalidBackup();
  return value;
}

/** Reads a backup file's text, checking every row so a bad file changes nothing. */
export function parseBackup(json: string): Result<Backup, BackupError> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not_json' };
  }
  if (!isObject(raw) || raw.app !== 'Open Loops') return { ok: false, error: 'not_open_loops' };
  if (typeof raw.formatVersion !== 'number') return { ok: false, error: 'invalid' };
  if (raw.formatVersion > EXPORT_FORMAT_VERSION) return { ok: false, error: 'newer_version' };

  try {
    return {
      ok: true,
      value: {
        exportedAt: optionalDate(raw.exportedAt),
        loops: list(raw.loops).map(toLoop),
        dailyCloses: list(raw.dailyCloses).map((row) => ({
          id: text(row.id),
          day: text(row.day),
          resolvedCount: count(row.resolvedCount),
          createdAt: date(row.createdAt),
          updatedAt: date(row.updatedAt),
        })),
        weeklyReviews: list(raw.weeklyReviews).map((row) => ({
          id: text(row.id),
          startedAt: date(row.startedAt),
          completedAt: optionalDate(row.completedAt),
          reviewedCount: row.reviewedCount == null ? null : count(row.reviewedCount),
          createdAt: date(row.createdAt),
          updatedAt: date(row.updatedAt),
        })),
        settings: list(raw.settings).map((row) => ({
          key: text(row.key),
          value: text(row.value),
          updatedAt: date(row.updatedAt),
        })),
      },
    };
  } catch (error) {
    if (error instanceof InvalidBackup) return { ok: false, error: 'invalid' };
    throw error;
  }
}

export type MergePlan<T> = { insert: T[]; update: T[]; unchanged: number };

/**
 * What restoring `incoming` over `current` would do, matching rows by `key`.
 * `current` should include soft-deleted rows, so a deletion made after the
 * backup is not undone.
 */
export function planMerge<Row extends { updatedAt: Date }, Incoming extends Row>(
  current: Row[],
  incoming: Incoming[],
  key: (row: Row) => string,
): MergePlan<Incoming> {
  const existing = new Map(current.map((row) => [key(row), row]));
  const plan: MergePlan<Incoming> = { insert: [], update: [], unchanged: 0 };
  for (const row of incoming) {
    const mine = existing.get(key(row));
    if (!mine) plan.insert.push(row);
    else if (row.updatedAt > mine.updatedAt) plan.update.push(row);
    else plan.unchanged += 1;
  }
  return plan;
}

/**
 * Settings that belong to this phone rather than to the data: a reminder needs
 * this phone's permission, and sending loops to the AI server is agreed to on
 * each phone, never switched on by a restore.
 */
export const DEVICE_SETTINGS = ['close_time', 'ai_suggestions'];
