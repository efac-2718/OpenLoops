// Browsers can't share a local file, so the web version downloads it instead.

import type { ShareResult } from './share-file';

export async function shareTextFile(
  name: string,
  content: string,
  mimeType: string,
): Promise<ShareResult> {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return 'shared';
}
