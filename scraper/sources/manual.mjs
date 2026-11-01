// Événements saisis à la main (data/manual.json), par ex. signalés par des organisateurs.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function run(source) {
  const path = fileURLToPath(new URL(`../${source.file}`, import.meta.url));
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(data) ? data : data.events ?? [];
  } catch {
    return [];
  }
}
