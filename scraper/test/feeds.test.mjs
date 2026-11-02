import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, findCommune } from '../sources/feeds.mjs';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:71@exemple.fr
DTSTART;TZID=Europe/Paris:20261108T190000
DTEND;TZID=Europe/Paris:20261108T230000
URL:https://www.exemple.fr/events/soiree-moules-frites-a-dierre/
SUMMARY:Soirée moules-frites à Dierre
LOCATION:Salle des fêtes\\, Dierre
DESCRIPTION:Repas dansant\\, sur réservation.
CATEGORIES:Culture
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261212
DTEND;VALUE=DATE:20261214
SUMMARY:Marché de Noël
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T070000Z
RRULE:FREQ=WEEKLY;BYDAY=TU,SA;UNTIL=20270331T000000Z
SUMMARY:Marché hebdomadaire
END:VEVENT
END:VCALENDAR`;

test('iCal : heures locales, dates seules, récurrence hebdomadaire', () => {
  const [a, b, c] = parseIcs(ICS);
  assert.equal(a.title, 'Soirée moules-frites à Dierre');
  assert.deepEqual(a.occurrences, [{ start: '2026-11-08', end: '2026-11-08', hours: '19:00–23:00' }]);
  assert.equal(a.location, 'Salle des fêtes, Dierre');
  assert.equal(a.description, 'Repas dansant, sur réservation.');
  // fin « date seule » exclusive : du 12 au 13
  assert.deepEqual(b.occurrences[0], { start: '2026-12-12', end: '2026-12-13', hours: null });
  // UTC → heure de Paris, récurrence mardi + samedi
  assert.equal(c.occurrences[0].hours, '08:00');
  assert.deepEqual(c.occurrences[0].days, [2, 6]);
  assert.equal(c.occurrences[0].end, '2027-03-31');
});

test('commune citée dans le titre', () => {
  const communes = [
    { name: 'Saint-Martin-le-Beau', key: 'saint martin le beau', postcode: '37270' },
    { name: 'Dierre', key: 'dierre', postcode: '37150' },
  ];
  assert.equal(findCommune('Marché de Noël à Saint-Martin-le-Beau', communes).postcode, '37270');
  assert.equal(findCommune('Soirée moules-frites à Dierre', communes).name, 'Dierre');
  assert.equal(findCommune('Concert gospel', communes), null);
});
