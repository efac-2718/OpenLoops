import { eq } from 'drizzle-orm';

import { DEFAULT_ACTIVE_CAP } from '@/domain/loop';

import type { Reader } from './client';
import { settings } from './schema';

export function getActiveCap(reader: Reader): number {
  const row = reader.select().from(settings).where(eq(settings.key, 'active_cap')).get();
  const cap = Number(row?.value);
  return Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_ACTIVE_CAP;
}
