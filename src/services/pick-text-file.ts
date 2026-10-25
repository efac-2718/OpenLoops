import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export type PickedFile = { name: string; text: string };

/** Lets the user choose a file and reads it as text, or null if they cancel. */
export async function pickTextFile(): Promise<PickedFile | null> {
  // Any type: phones often label .json files as plain binary data.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;

  const asset = result.assets[0];
  return { name: asset.name, text: await new File(asset.uri).text() };
}
