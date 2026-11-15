import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../lib/osmpoi.mjs';

test('petits lieux OpenStreetMap : type et nom par défaut', () => {
  assert.deepEqual(classify({ historic: 'wayside_cross' }), { kind: 'petitpatrimoine', sub: 'croix', label: 'Croix' });
  assert.equal(classify({ leisure: 'playground' }).sub, 'jeux');
  assert.equal(classify({ leisure: 'pitch', sport: 'boules' }).label, 'Boulodrome');
  assert.equal(classify({ leisure: 'pitch', sport: 'petanque;boules' }).sub, 'boulodrome');
  assert.equal(classify({ leisure: 'pitch', sport: 'multi' }).sub, 'multisport');
  assert.equal(classify({ tourism: 'viewpoint' }).kind, 'nature');
  assert.equal(classify({ leisure: 'pitch', sport: 'soccer' }), null);
});
