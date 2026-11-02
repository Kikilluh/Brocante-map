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
  assert.equal(raws.length, 1);
  assert.equal(raws[0].occurrences.length, 2);
  assert.equal(raws[0].occurrences[1].start, '2026-12-06');
});

test('API v1 : prix, public, jauge, dates multiples', () => {
  const n = {
    uuid: 'x', type: ['PointOfInterest', 'EntertainmentAndEvent', 'MusicEvent', 'Concert'],
    label: { '@fr': 'Concert du soir' },
    isLocatedAt: [{ address: [{ postalCode: '37000', addressLocality: 'Tours', streetAddress: ['Place Plumereau'] }], geo: { latitude: 47.39, longitude: 0.68 } }],
    takesPlaceAt: [{ startDate: '2026-11-20', endDate: '2026-11-20', startTime: '20:30:00' }, { startDate: '2026-11-21', endDate: '2026-11-21' }],
    offers: [{ priceSpecification: [{ minPrice: 8, maxPrice: 15, priceCurrency: 'EUR' }] }],
    hasClientTarget: [{ requiredMinAge: 12 }],
    allowedPersons: 150,
    hasBeenCreatedBy: { legalName: 'Office de tourisme Tours Val de Loire' },
  };
  const [raw] = mapNode(n);
  const ev = makeEvent(raw, 'datatourisme');
  assert.equal(ev.category, 'concert');
  assert.equal(ev.priceMin, 8);
  assert.equal(ev.priceMax, 15);
  assert.equal(ev.free, false);
  assert.equal(ev.ageMin, 12);
  assert.equal(ev.capacity, 150);
  assert.equal(ev.occurrences.length, 2);
  assert.equal(ev.hours, '20:30');
  assert.equal(ev.credit, 'Office de tourisme Tours Val de Loire');
});

test('nom du lieu tiré de l\'adresse', async () => {
  const { splitVenue } = await import('../lib/venues.mjs');
  assert.deepEqual(splitVenue(['Le Temps Machine', '45-49 rue des Martyrs']), { venue: 'Le Temps Machine', address: '45-49 rue des Martyrs' });
  assert.deepEqual(splitVenue(['25 Avenue André Malraux']), { venue: null, address: '25 Avenue André Malraux' });
  assert.deepEqual(splitVenue(['Place du marché']), { venue: null, address: 'Place du marché' });
  assert.deepEqual(splitVenue(['Forteresse royale de Chinon']), { venue: 'Forteresse royale de Chinon', address: null });
  const [raw] = mapNode({ label: { '@fr': 'Concert' }, isLocatedAt: [{ address: [{ postalCode: '37300', streetAddress: ['Le Temps Machine', '45 rue des Martyrs'] }] }], takesPlaceAt: [{ startDate: '2026-12-01' }], hasContact: [{ legalName: 'Asso Rock' }] });
  const ev = makeEvent(raw, 'datatourisme');
  assert.equal(ev.venue, 'Le Temps Machine');
  assert.equal(ev.address, '45 rue des Martyrs');
  assert.equal(ev.organizer, 'Asso Rock');
});

test('image principale et crédits (droits expirés ignorés)', async () => {
  const { readImage } = await import('../sources/datatourisme.mjs');
  const n = { hasMainRepresentation: [{ hasAnnotation: [{ credits: ['© OT Amboise'] }], hasRelatedResource: [{ locator: ['https://static.example/photo.jpg'], hasMimeType: [{ label: { '@fr': 'image/jpeg' } }] }] }] };
  assert.deepEqual(readImage(n), { image: 'https://static.example/photo.jpg', imageCredit: '© OT Amboise' });
  const old = { hasMainRepresentation: [{ hasAnnotation: [{ rightsEndDate: '2020-01-01' }], hasRelatedResource: [{ locator: ['https://x/y.jpg'] }] }] };
  assert.deepEqual(readImage(old), {});
});

test('période longue « tous les mardis » → une date par mardi', async () => {
  const { expandRecurring } = await import('../lib/normalize.mjs');
  const { weekdaysOf } = await import('../sources/datatourisme.mjs');
  assert.deepEqual(weekdaysOf([{ '@id': 'schema:Tuesday' }]), [2]);
  assert.equal(weekdaysOf(null), null);
  const occ = expandRecurring([{ start: '2026-11-01', end: '2027-03-31', hours: '08:00', days: [2] }], { today: '2026-11-02', horizon: '2026-11-30' });
  assert.deepEqual(occ.map((o) => o.start), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  assert.equal(occ[0].hours, '08:00');
  // période courte : inchangée (jours retirés)
  assert.deepEqual(expandRecurring([{ start: '2026-11-07', end: '2026-11-08', days: [6, 0] }], { today: '2026-11-02', horizon: '2026-12-31' }), [{ start: '2026-11-07', end: '2026-11-08' }]);
});

test('jours de la semaine lus dans le texte', async () => {
  const { weekdaysFromText } = await import('../sources/datatourisme.mjs');
  assert.deepEqual(weekdaysFromText('Marché tous les mardis et vendredis matin'), [2, 5]);
  assert.deepEqual(weekdaysFromText('Chaque samedi, place du marché'), [6]);
  assert.deepEqual(weekdaysFromText('Ouvert le jeudi matin'), [4]);
  assert.deepEqual(weekdaysFromText('Les mercredis, samedis et dimanches'), [0, 3, 6]);
  assert.equal(weekdaysFromText('Rendez-vous le samedi 12 novembre'), null);
  assert.equal(weekdaysFromText('Concert le samedi à 20 h'), null);
  assert.equal(weekdaysFromText('Marché Mistral'), null);
});
