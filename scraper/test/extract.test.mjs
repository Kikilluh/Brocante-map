import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractEvents, extractLinks, extractMicrodataEvents } from '../lib/jsonld.mjs';
import { makeEvent, toDay, deptFromPostcode, guessType } from '../lib/normalize.mjs';
import { dedupe } from '../lib/dedupe.mjs';

const html = readFileSync(new URL('./fixtures/listing.html', import.meta.url), 'utf8');

test('extrait les événements JSON-LD imbriqués (@graph / ItemList)', () => {
  const raws = extractEvents(html, 'https://example.org/37');
  assert.equal(raws.length, 2);
  const ev = makeEvent(raws[0], 'test');
  assert.equal(ev.title, 'Vide-grenier du Comité des fêtes');
  assert.equal(ev.type, 'vide-grenier');
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
  assert.equal(guessType('Braderie des commerçants'), 'braderie');
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
