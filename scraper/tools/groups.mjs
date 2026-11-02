#!/usr/bin/env node
// Affiche les groupes de départements de config.json au format attendu par la matrice GitHub Actions.
import { loadConfig } from '../lib/config.mjs';
const config = await loadConfig();
const groups = Object.entries(config.groups ?? { tous: config.departments }).map(([name, depts]) => ({ name, depts: depts.join(',') }));
console.log(JSON.stringify(groups));
