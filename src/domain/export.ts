/**
 * Turning the user's data into files they own: Markdown to read, JSON to keep
 * or move elsewhere. Dates in Markdown are YYYY-MM-DD so the file reads the
 * same in every locale.
 */

import { dayKey } from './dates';
import type { Loop, LoopState } from './loop';

export const EXPORT_FORMAT_VERSION = 1;

export type ExportData = {
  loops: Loop[];
  dailyCloses: { id: string; day: string; resolvedCount: number; createdAt: Date; updatedAt: Date }[];
  settings: { key: string; value: string; updatedAt: Date }[];
};

export function exportFileName(extension: 'md' | 'json', now: Date): string {
  return `open-loops-${dayKey(now)}.${extension}`;
}

/** Everything, with dates as ISO 8601 strings. */
export function toJson(data: ExportData, exportedAt: Date): string {
  return JSON.stringify(
    { app: 'Open Loops', formatVersion: EXPORT_FORMAT_VERSION, exportedAt, ...data },
    null,
    2,
  );
}

const time = (date: Date | null) => date?.getTime() ?? 0;

const SECTIONS: {
  state: LoopState;
  heading: string;
  line: (loop: Loop) => string;
  order: (a: Loop, b: Loop) => number;
}[] = [
  {
    state: 'inbox',
    heading: 'Inbox',
    line: (loop) => loop.title,
    order: (a, b) => time(a.createdAt) - time(b.createdAt),
  },
  {
    state: 'scheduled',
    heading: 'Scheduled',
    line: (loop) =>
      `${loop.dueAt ? `${dayKey(loop.dueAt)}: ` : ''}${loop.nextAction} (${loop.title})`,
    order: (a, b) => time(a.dueAt) - time(b.dueAt),
  },
  {
    state: 'next',
    heading: 'Next actions',
    line: (loop) => `${loop.nextAction} (${loop.title})`,
    order: (a, b) => time(a.updatedAt) - time(b.updatedAt),
  },
  {
    state: 'waiting',
    heading: 'Waiting on someone',
    line: (loop) => `${loop.title}, waiting on ${loop.waitingOn}`,
    order: (a, b) => time(a.updatedAt) - time(b.updatedAt),
  },
  {
    state: 'thinking',
    heading: 'Thinking on this',
    line: (loop) => `${loop.title}${loop.revisitAt ? `, revisit ${dayKey(loop.revisitAt)}` : ''}`,
    order: (a, b) => time(a.revisitAt) - time(b.revisitAt),
  },
  {
    state: 'done',
    heading: 'Done',
    line: (loop) => `${loop.title}${loop.closedAt ? ` (${dayKey(loop.closedAt)})` : ''}`,
    order: (a, b) => time(b.closedAt) - time(a.closedAt),
  },
  {
    state: 'dropped',
    heading: 'Dropped',
    line: (loop) => `${loop.title}${loop.closedAt ? ` (${dayKey(loop.closedAt)})` : ''}`,
    order: (a, b) => time(b.closedAt) - time(a.closedAt),
  },
];

/** A readable list of every loop, grouped by its decision. Empty groups are left out. */
export function toMarkdown(loops: Loop[], exportedAt: Date): string {
  const lines = ['# Open Loops', '', `Exported ${dayKey(exportedAt)}.`];

  for (const section of SECTIONS) {
    const inSection = loops
      .filter((loop) => loop.state === section.state && !loop.deletedAt)
      .sort(section.order);
    if (inSection.length === 0) continue;
    lines.push('', `## ${section.heading} (${inSection.length})`, '');
    // A loop captured over several lines stays one list item.
    lines.push(...inSection.map((loop) => `- ${section.line(loop).replace(/\s*\n\s*/g, ' ')}`));
  }

  if (lines.length === 3) lines.push('', 'Nothing here yet.');
  return lines.join('\n') + '\n';
}
