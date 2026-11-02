#!/usr/bin/env node
// Envoie le rapport de collecte par e-mail via Resend (gratuit jusqu'à 3 000 mails / mois).
// Secret RESEND_API_KEY ; destinataire REPORT_TO. Sans domaine vérifié chez Resend, l'expéditeur
// onboarding@resend.dev ne peut écrire qu'à l'adresse du compte Resend : c'est le cas ici.
// Usage : node scraper/tools/send-report.mjs [statut]   (statut = success | failure)

import { readFile } from 'node:fs/promises';

const key = process.env.RESEND_API_KEY;
const to = process.env.REPORT_TO;
if (!key || !to) {
  console.log('RESEND_API_KEY ou REPORT_TO absent : pas d\'envoi.');
  process.exit(0);
}
const status = process.argv[2] ?? 'success';
const runUrl = process.env.RUN_URL ?? '';
let report = '';
try { report = await readFile('rapport-collecte.md', 'utf8'); } catch { /* fusion non atteinte */ }

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// Markdown simple → HTML (titres, tableau, listes, gras)
function toHtml(md) {
  const out = [];
  let table = null;
  for (const line of md.split('\n')) {
    if (/^\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!table) { table = []; out.push('<table style="border-collapse:collapse;font:14px sans-serif">'); }
      const tag = table.length ? 'td' : 'th';
      out.push(`<tr>${cells.map((c) => `<${tag} style="border:1px solid #ddd;padding:4px 8px;text-align:left">${esc(c)}</${tag}>`).join('')}</tr>`);
      table.push(cells);
      continue;
    }
    if (table) { out.push('</table>'); table = null; }
    if (/^## /.test(line)) out.push(`<h2 style="font:600 18px sans-serif">${esc(line.slice(3))}</h2>`);
    else if (/^- /.test(line)) out.push(`<div style="font:14px sans-serif">• ${esc(line.slice(2))}</div>`);
    else if (line.trim()) out.push(`<p style="font:14px sans-serif">${esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`);
  }
  if (table) out.push('</table>');
  return out.join('\n');
}

const alerts = (report.match(/\*\*(\d+) alerte/) ?? [])[1];
const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date());
const subject = status === 'failure'
  ? `⚠️ Brocante Map : la collecte du ${date} a échoué`
  : `Brocante Map : collecte du ${date}${alerts ? ` (${alerts} alerte${alerts > 1 ? 's' : ''})` : ''}`;
const html = `${status === 'failure' ? '<p style="font:600 15px sans-serif;color:#b3261e">La collecte ou la mise en ligne a échoué : le site garde les données de la veille.</p>' : ''}
${report ? toHtml(report) : '<p>Pas de rapport (la collecte s\'est arrêtée avant).</p>'}
${runUrl ? `<p style="font:13px sans-serif"><a href="${runUrl}">Détails de la collecte sur GitHub</a></p>` : ''}`;

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: 'Brocante Map <onboarding@resend.dev>', to: [to], subject, html }),
});
console.log(`Envoi du rapport à ${to} : HTTP ${res.status} ${await res.text()}`);
