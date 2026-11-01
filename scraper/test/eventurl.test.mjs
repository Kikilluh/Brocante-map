import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEventUrl } from '../lib/normalize.mjs';

test("isEventUrl : site général de l'organisateur vs page de l'événement", () => {
  assert.equal(isEventUrl('https://www.lpo.fr/lpo-locales/lpo-centre-val-de-loire', 'Le bal hivernal des oiseaux'), false);
  assert.equal(isEventUrl('https://cccod.fr/', 'Exposition Calder au cœur de la France'), false);
  assert.equal(isEventUrl('https://example.fr/agenda/bal-hivernal-oiseaux-2026', 'Le bal hivernal des oiseaux'), true);
  assert.equal(isEventUrl(null, 'x'), false);
});
