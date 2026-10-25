import { eq } from 'drizzle-orm';

import { DEFAULT_ACTIVE_CAP } from '@/domain/loop';

import { getDb, type Reader } from './client';
import { settings } from './schema';

export type SettingKey = 'active_cap' | 'close_time' | 'ai_suggestions';

export function settingQuery(key: SettingKey) {
  return getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
}

export function setSetting(key: SettingKey, value: string) {
  const updatedAt = new Date();
  getDb()
    .insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })
    .run();
}

export function parseActiveCap(value: string | undefined): number {
  const cap = Number(value);
  return Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_ACTIVE_CAP;
}

export function getActiveCap(reader: Reader): number {
  const row = reader.select().from(settings).where(eq(settings.key, 'active_cap')).get();
  return parseActiveCap(row?.value);
}
