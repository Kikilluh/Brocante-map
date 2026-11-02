// Stockage des données publiées, découpées par département :
//   public/data/index.json            → liste des départements (nom, emprise, nombre d'éléments), sources, dates
//   public/data/<dept>/events.json    → événements du département
//   public/data/<dept>/places.json    → lieux et activités « toute l'année » du département
// Le site ne télécharge que les départements visibles sur la carte : le poids d'une visite ne grossit
// pas quand on ajoute des départements.

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data');

export const DEPT_NAMES = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes',
  '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône',
  '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '2A': 'Corse-du-Sud',
  '2B': 'Haute-Corse', '21': "Côte-d'Or", '22': "Côtes-d'Armor", '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme',
  '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde',
  '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura', '40': 'Landes',
  '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot',
  '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne',
  '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
  '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées',
  '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire',
  '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne',
  '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse',
  '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Territoire de Belfort',
  '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': "Val-d'Oise",
  '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte',
};

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export const readIndex = () => readJson(join(DATA_DIR, 'index.json'), {});

/** Données précédemment publiées (kind = 'events' | 'places'), chaque élément avec son département. */
export async function readPrevious(kind) {
  const index = await readIndex();
  const out = [];
  for (const d of Object.keys(index.depts ?? {})) {
    const data = await readJson(join(DATA_DIR, d, `${kind}.json`), {});
    for (const x of data[kind] ?? []) out.push({ ...x, dept: x.dept ?? d });
  }
  return out;
}

/** Département d'un élément sans code postal : celui dont l'emprise le contient. */
export function deptByBbox(x, bboxes) {
  for (const [d, [s, w, n, e]] of Object.entries(bboxes)) {
    if (x.lat >= s && x.lat <= n && x.lon >= w && x.lon <= e) return d;
  }
  return null;
}

const srcIds = (x) => (x.sources ?? []).map((s) => s.id ?? s);

/**
 * Filet de sécurité : si une source n'a rien renvoyé pour un département alors qu'elle en avait
 * auparavant (site en panne, quota…), on garde ses anciens éléments encore valables.
 */
export function keepMissing(items, previous, { departments, stillValid = () => true, log = () => {} }) {
  const have = new Set();
  for (const x of items) for (const s of srcIds(x)) have.add(`${s}|${x.dept}`);
  const ids = new Set(items.map((x) => x.id));
  const kept = {};
  for (const x of previous) {
    if (!departments.includes(x.dept) || ids.has(x.id) || !stillValid(x)) continue;
    const s = srcIds(x)[0];
    if (!s || have.has(`${s}|${x.dept}`)) continue;
    items.push(x);
    kept[`${s} (${x.dept})`] = (kept[`${s} (${x.dept})`] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(kept)) log(`  ⚠ ${k} : aucune donnée aujourd'hui, ${n} élément(s) de la veille conservé(s)`);
  return items;
}

function bboxOf(items) {
  let [s, w, n, e] = [90, 180, -90, -180];
  for (const x of items) {
    s = Math.min(s, x.lat); n = Math.max(n, x.lat);
    w = Math.min(w, x.lon); e = Math.max(e, x.lon);
  }
  return [s, w, n, e].map((v) => Math.round(v * 1000) / 1000);
}

/** Écrit un fichier par département et met à jour index.json. */
export async function writeSplit(kind, items, { departments, all = departments, sources }) {
  const index = await readIndex();
  index.depts ??= {};
  for (const d of departments) {
    const mine = items.filter((x) => x.dept === d);
    await mkdir(join(DATA_DIR, d), { recursive: true });
    await writeFile(join(DATA_DIR, d, `${kind}.json`), JSON.stringify({ [kind]: mine }));
    const info = (index.depts[d] ??= {});
    info.name = DEPT_NAMES[d] ?? `Département ${d}`;
    info[kind] = mine.length;
    // emprise du département = union de celle des événements et de celle des lieux
    info.bboxes = { ...info.bboxes, [kind]: mine.length ? bboxOf(mine) : undefined };
    const bs = Object.values(info.bboxes).filter(Boolean);
    info.bbox = bs.length ? [Math.min(...bs.map((x) => x[0])), Math.min(...bs.map((x) => x[1])), Math.max(...bs.map((x) => x[2])), Math.max(...bs.map((x) => x[3]))] : null;
  }
  // départements retirés de la configuration
  for (const d of Object.keys(index.depts)) {
    if (all.includes(d)) continue;
    delete index.depts[d];
    await rm(join(DATA_DIR, d), { recursive: true, force: true });
  }
  index.departments = all;
  index.generatedAt = new Date().toISOString();
  index.updated = { ...index.updated, [kind]: index.generatedAt };
  // rapport des sources de cette collecte uniquement (pas d'imbrication des rapports précédents)
  index.sources = { events: index.sources?.events ?? null, places: index.sources?.places ?? null, [kind]: sources };
  if (index.sources.events?.events || index.sources.events?.departments) index.sources.events = null;
  if (index.sources.places?.places || index.sources.places?.departments) index.sources.places = null;
  await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 1));
  // anciens fichiers uniques (avant le découpage)
  for (const f of await readdir(DATA_DIR)) if (['events.json', 'places.json', 'brocantes.json'].includes(f)) await rm(join(DATA_DIR, f));
}
