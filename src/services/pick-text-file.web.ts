// expo-file-system isn't available on the web, so read the browser's own File.

import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from './pick-text-file';

export async function pickTextFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  return { name: asset.name, text };
}
