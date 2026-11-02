import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPoint, mapRelation } from '../lib/routes.mjs';

const p = (lat, lon) => ({ lat, lon });

test('point de départ = extrémité du 1er tronçon non partagée avec le 2e', () => {
  const w1 = [p(47.0, 0.5), p(47.01, 0.5)];
  const w2 = [p(47.01, 0.5), p(47.02, 0.51)];
  assert.deepEqual(startPoint([w1, w2]), p(47.0, 0.5));
  // 1er tronçon dessiné « à l'envers »
  assert.deepEqual(startPoint([[...w1].reverse(), w2]), p(47.0, 0.5));
});

test('relation OSM → itinéraire avec lien Waymarked Trails', () => {
  const r = mapRelation({
    id: 123, tags: { type: 'route', route: 'hiking', name: 'Boucle des Vignes', network: 'lwn', distance: '12,5' },
    members: [{ type: 'way', geometry: [p(47.4, 0.8), p(47.41, 0.8)] }, { type: 'way', geometry: [p(47.41, 0.8), p(47.42, 0.81)] }],
  });
  assert.equal(r.kind, 'rando');
  assert.equal(r.lat, 47.4);
  assert.equal(r.distanceKm, 12.5);
  assert.equal(r.routeUrl, 'https://hiking.waymarkedtrails.org/#route?id=123');
  assert.equal(r.network, 'boucle locale');
  const v = mapRelation({ id: 9, tags: { route: 'bicycle', name: 'La Loire à Vélo', network: 'icn' }, members: [{ type: 'way', geometry: [p(47.3, 0.4), p(47.3, 0.5)] }] });
  assert.equal(v.kind, 'velo');
  assert.equal(v.partial, true);
  assert.match(v.routeUrl, /cycling\.waymarkedtrails/);
});

test('tracé : tronçons enchaînés, simplifiés et arrondis', async () => {
  const { traceOf, simplify } = await import('../lib/routes.mjs');
  // points alignés → seules les extrémités restent
  assert.equal(simplify([p(47, 0.5), p(47.001, 0.5), p(47.002, 0.5), p(47.003, 0.5)]).length, 2);
  const lines = traceOf([[p(47.0, 0.5), p(47.01, 0.5)], [p(47.02, 0.51), p(47.01, 0.5)], [p(48, 1), p(48.1, 1)]]);
  assert.equal(lines.length, 2); // 2 premiers tronçons raccordés (le 2e à l'envers), 3e séparé
  assert.deepEqual(lines[0], [[47, 0.5], [47.01, 0.5], [47.02, 0.51]]);
});
