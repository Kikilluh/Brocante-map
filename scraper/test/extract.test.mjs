import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractEvents, extractLinks, extractMicrodataEvents } from '../lib/jsonld.mjs';
import { makeEvent, toDay, deptFromPostcode, guessType, guessCategory, parsePrice, parseAge, parseCapacity } from '../lib/normalize.mjs';
import { dedupe } from '../lib/dedupe.mjs';

const html = readFileSync(new URL('./fixtures/listing.html', import.meta.url), 'utf8');

test('extrait les événements JSON-LD imbriqués (@graph / ItemList)', () => {
  const raws = extractEvents(html, 'https://example.org/37');
  assert.equal(raws.length, 2);
  const ev = makeEvent(raws[0], 'test');
  assert.equal(ev.title, 'Vide-grenier du Comité des fêtes');
  assert.equal(ev.category, 'brocante');
  assert.equal(ev.start, '2026-11-08');
  assert.equal(ev.dept, '37');
  assert.equal(ev.lat, 47.41);
  assert.equal(ev.url, 'https://example.org/evenement/123');
});

test('microdonnées en repli', () => {
  const m = extractMicrodataEvents(html);
  assert.equal(m[0].name, 'Braderie micro');
  assert.equal(m[0].startDate, '2026-12-01');
});

test('liens de fiches détail', () => {
  const links = extractLinks(html, 'https://example.org/37', '^https://example\\.org/evenement/');
  assert.deepEqual(links, ['https://example.org/evenement/123', 'https://example.org/evenement/456?ref=1']);
});

test('dates converties en heure de Paris', () => {
  assert.equal(toDay('2026-11-07T23:30:00Z'), '2026-11-08');
  assert.equal(toDay('2026-11-08'), '2026-11-08');
  assert.equal(toDay('n/a'), null);
});

test('département depuis code postal', () => {
  assert.equal(deptFromPostcode('37000'), '37');
  assert.equal(deptFromPostcode('20100'), '2A');
  assert.equal(deptFromPostcode('97400'), '974');
  assert.equal(guessType('Braderie des commerçants'), 'brocante');
});

test('fusion des doublons multi-sources', () => {
  const a = makeEvent({ title: 'Vide grenier annuel', start: '2026-11-08', city: 'Amboise', postcode: '37400' }, 'a');
  const b = makeEvent({ title: 'Grand vide-grenier', start: '2026-11-08', city: 'AMBOISE', postcode: '37400', lat: 1, lon: 2 }, 'b');
  const c = makeEvent({ title: 'Vide grenier', start: '2026-11-09', city: 'Amboise' }, 'c');
  const out = dedupe([a, b, c]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].sources.map((s) => s.id), ['a', 'b']);
  assert.equal(out[0].lat, 1);
});

test('catégories', () => {
  assert.equal(guessCategory({ title: 'Atelier poterie parents-enfants' }), 'atelier');
  assert.equal(guessCategory({ title: 'Randonnée des vignes' }), 'rando');
  assert.equal(guessCategory({ title: 'Les Fourberies de Scapin', types: 'TheaterEvent' }), 'spectacle');
  assert.equal(guessCategory({ title: 'Vide-grenier de printemps' }), 'brocante');
  assert.equal(guessCategory({ title: 'Machin truc' }), 'autre');
});

test('prix, âges, jauge depuis le texte', () => {
  assert.deepEqual(parsePrice('Tarif 8 € / réduit 5 €'), { free: null, priceMin: 5, priceMax: 8 });
  assert.deepEqual(parsePrice('Entrée libre'), { free: true, priceMin: 0, priceMax: 0 });
  assert.deepEqual(parsePrice('Gratuit pour les enfants, 5 € adultes'), { free: false, priceMin: 0, priceMax: 5 });
  assert.deepEqual(parseAge('dès 6 ans'), { ageMin: 6, ageMax: null });
  assert.deepEqual(parseAge('pour les 8-12 ans'), { ageMin: 8, ageMax: 12 });
  assert.deepEqual(parseAge('Entrée 5 €, gratuit jusqu\'à 26 ans'), { ageMin: null, ageMax: null });
  assert.deepEqual(parseAge('Tarif réduit pour les moins de 12 ans. Atelier dès 6 ans'), { ageMin: 6, ageMax: null });
  assert.equal(parseCapacity('Places limitées à 15 personnes'), 15);
  assert.equal(parseCapacity('200 exposants'), null);
});

test('deux événements différents le même jour au même endroit ne sont pas fusionnés', () => {
  const a = makeEvent({ title: 'Concert de jazz', start: '2026-11-08', city: 'Tours' }, 'a');
  const b = makeEvent({ title: 'Atelier poterie', start: '2026-11-08', city: 'Tours' }, 'b');
  assert.equal(dedupe([a, b]).length, 2);
});
