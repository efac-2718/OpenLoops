import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ShareResult = 'shared' | 'unavailable';

/** Writes `content` to a temporary file and opens the system share sheet for it. */
export async function shareTextFile(
  name: string,
  content: string,
  mimeType: string,
): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export Open Loops' });
  return 'shared';
}
