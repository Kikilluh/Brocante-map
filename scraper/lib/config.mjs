// Lecture de config.json : la liste des départements découle des groupes (régions).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json');

export async function loadConfig() {
  const config = JSON.parse(await readFile(FILE, 'utf8'));
  config.departments = config.groups ? Object.values(config.groups).flat() : (config.departments ?? []);
  return config;
}

/** Départements à collecter : --dept=37,45 si fourni, sinon tous. */
export function deptsFromArgs(config, argv = process.argv.slice(2)) {
  const arg = argv.find((a) => a.startsWith('--dept='));
  return arg ? arg.slice(7).split(',').filter(Boolean) : config.departments;
}
