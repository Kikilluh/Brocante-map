import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepMissing, deptByBbox } from '../lib/store.mjs';

test('keepMissing : garde les éléments de la veille d\'une source muette dans un département', () => {
  const today = [{ id: 'a', dept: '45', sources: [{ id: 'osm' }] }];
  const previous = [
    { id: 'b', dept: '58', sources: [{ id: 'osm' }] }, // osm n'a rien donné pour le 58 aujourd'hui → gardé
    { id: 'c', dept: '45', sources: [{ id: 'osm' }] }, // osm a répondu pour le 45 → pas gardé (disparu pour de bon)
    { id: 'd', dept: '58', sources: [{ id: 'dt' }], end: '2020-01-01' }, // périmé → pas gardé
    { id: 'e', dept: '99', sources: [{ id: 'dt' }] }, // département plus couvert → pas gardé
  ];
  const out = keepMissing(today, previous, { departments: ['45', '58'], stillValid: (x) => !x.end || x.end >= '2026-01-01' });
  assert.deepEqual(out.map((x) => x.id), ['a', 'b']);
});

test('deptByBbox', () => {
  assert.equal(deptByBbox({ lat: 47.9, lon: 1.9 }, { 37: [46.7, -0.1, 47.7, 1.4], 45: [47.5, 1.5, 48.4, 3.1] }), '45');
  assert.equal(deptByBbox({ lat: 43, lon: 5 }, { 37: [46.7, -0.1, 47.7, 1.4] }), null);
});
