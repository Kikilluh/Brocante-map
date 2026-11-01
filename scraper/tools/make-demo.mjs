// Génère public/data/demo.json : données FICTIVES affichées tant qu'aucune collecte réelle n'a eu lieu.
import { writeFileSync } from 'node:fs';

const COMMUNES = [
  ['Tours', '37000', 47.3941, 0.6848], ['Amboise', '37400', 47.4125, 0.9826], ['Chinon', '37500', 47.1672, 0.2417],
  ['Loches', '37600', 47.1286, 0.9953], ['Joué-lès-Tours', '37300', 47.3522, 0.6633], ['Saint-Cyr-sur-Loire', '37540', 47.4, 0.6667],
  ['Saint-Avertin', '37550', 47.3633, 0.7392], ['Montlouis-sur-Loire', '37270', 47.3886, 0.8275], ['Chambray-lès-Tours', '37170', 47.3356, 0.7139],
  ['Bléré', '37150', 47.3256, 0.9908], ['Azay-le-Rideau', '37190', 47.2597, 0.4656], ['Langeais', '37130', 47.3247, 0.4058],
  ['Château-Renault', '37110', 47.5933, 0.9122], ['Richelieu', '37120', 47.0147, 0.3236], ['Sainte-Maure-de-Touraine', '37800', 47.1114, 0.6211],
  ['Vouvray', '37210', 47.4111, 0.7989], ['Ballan-Miré', '37510', 47.3378, 0.6131], ['Fondettes', '37230', 47.4036, 0.5983],
  ['Bourgueil', '37140', 47.2817, 0.1683], ['Neuillé-Pont-Pierre', '37360', 47.5483, 0.55], ['Montbazon', '37250', 47.2864, 0.7122],
  ['Descartes', '37160', 46.9725, 0.6992], ["L'Île-Bouchard", '37220', 47.1194, 0.4256], ['Preuilly-sur-Claise', '37290', 46.8544, 0.9294],
];
const KINDS = [
  ['vide-grenier', 'Vide-grenier du comité des fêtes'], ['brocante', 'Brocante annuelle'], ['vide-grenier', "Vide-grenier de l'école"],
  ['braderie', 'Braderie des commerçants'], ['puces', 'Marché aux puces'], ['bourse', 'Bourse aux jouets'], ['brocante', 'Brocante et antiquités'],
];
let seed = 37;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const iso = (d) => d.toISOString().slice(0, 10);
const events = [];
const start = new Date(process.argv[2] ?? Date.now());
start.setUTCHours(12, 0, 0, 0);
for (let i = 0; i < 140; i++) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + Math.floor(rnd() * 120));
  if (rnd() < 0.8) d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7) + (rnd() < 0.5 ? 1 : 0)); // surtout le week-end
  const [city, postcode, lat, lon] = COMMUNES[Math.floor(rnd() * COMMUNES.length)];
  const [type, title] = KINDS[Math.floor(rnd() * KINDS.length)];
  const end = new Date(d);
  if (type === 'braderie' && rnd() < 0.5) end.setUTCDate(end.getUTCDate() + 1);
  events.push({
    id: `demo-${i}`, title: `${title} (exemple)`, type, start: iso(d), end: iso(end), city, postcode, dept: '37',
    address: null, lat: +(lat + (rnd() - 0.5) * 0.03).toFixed(5), lon: +(lon + (rnd() - 0.5) * 0.04).toFixed(5),
    hours: rnd() < 0.7 ? '7h–18h' : '8h–17h', exhibitors: rnd() < 0.6 ? 20 + Math.floor(rnd() * 180) : null,
    description: 'Événement fictif de démonstration.', url: null, sources: [{ id: 'démo', url: null }],
  });
}
events.sort((a, b) => a.start.localeCompare(b.start));
writeFileSync(new URL('../../public/data/demo.json', import.meta.url), JSON.stringify({ demo: true, departments: ['37'], events }, null, 1));
console.log(`${events.length} événements fictifs générés`);
