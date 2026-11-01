import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapNode, listOf, fr } from '../sources/datatourisme.mjs';
import { makeEvent } from '../lib/normalize.mjs';

test('fr() gère les formes multilingues', () => {
  assert.equal(fr({ fr: ['Brocante'] }), 'Brocante');
  assert.equal(fr({ fr: 'Brocante' }), 'Brocante');
  assert.equal(fr([{ '@language': 'en', '@value': 'Flea' }, { '@language': 'fr', '@value': 'Puces' }]), 'Puces');
  assert.equal(fr('x'), 'x');
});

test('objet au format flux JSON-LD (préfixes schema:/rdfs:)', () => {
  const n = {
    '@type': ['schema:Event', 'SaleEvent'],
    'rdfs:label': { fr: ['Vide-grenier de Vouvray'] },
    isLocatedAt: [{ 'schema:address': [{ 'schema:postalCode': '37210', 'schema:streetAddress': ['Place du marché'], hasAddressCity: { 'rdfs:label': { fr: ['Vouvray'] } } }], 'schema:geo': { 'schema:latitude': '47.41', 'schema:longitude': '0.79' } }],
    takesPlaceAt: [{ startDate: '2026-11-08', endDate: '2026-11-08', startTime: '07:00:00', endTime: '18:00:00' }],
  };
  const [r] = mapNode(n);
  const ev = makeEvent(r, 'datatourisme');
  assert.equal(ev.title, 'Vide-grenier de Vouvray');
  assert.equal(ev.city, 'Vouvray');
  assert.equal(ev.dept, '37');
  assert.equal(ev.lat, 47.41);
  assert.equal(ev.hours, '07:00–18:00');
});

test('objet au format API sans préfixes, plusieurs dates', () => {
  const data = { objects: [{ uuid: 'a', type: ['Event'], label: { fr: 'Braderie de Loches' }, isLocatedAt: [{ address: [{ postalCode: '37600', hasAddressCity: [{ label: { fr: 'Loches' } }] }], geo: { latitude: 47.1, longitude: 1 } }], takesPlaceAt: [{ startDate: '2026-11-08' }, { startDate: '2026-12-06' }] }, { label: { fr: 'Concert' } }] };
  const items = listOf(data);
  assert.equal(items.length, 2);
  const raws = items.flatMap(mapNode);
  assert.equal(raws.length, 2);
  assert.equal(raws[1].start, '2026-12-06');
});
