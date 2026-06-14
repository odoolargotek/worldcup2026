// Largotek SRL - World Cup 2026 ICS Generator
// Ejecutar con: node generate_ics.js
// Lee fixtures.json y genera worldcup2026_largotek_all.ics

const fs = require('fs');

const fixtures = JSON.parse(fs.readFileSync('./fixtures.json', 'utf8'));

function formatDateToICS(dt) {
  const d = new Date(dt);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const now = formatDateToICS(new Date().toISOString());

let ics = '';
ics += 'BEGIN:VCALENDAR\r\n';
ics += 'PRODID:-//Largotek SRL//WorldCup2026 by Largotek//ES\r\n';
ics += 'VERSION:2.0\r\n';
ics += 'CALSCALE:GREGORIAN\r\n';
ics += 'METHOD:PUBLISH\r\n';
ics += 'X-WR-CALNAME:World Cup 2026 - Largotek\r\n';
ics += 'X-WR-TIMEZONE:UTC\r\n';
ics += 'X-WR-CALDESC:Calendario de partidos del Mundial 2026 generado por Largotek SRL.\r\n';

for (const match of fixtures.fixtures) {
  const uid = `wc2026-${match.id}@largotek.com`;
  const dtstart = formatDateToICS(match.date_utc);
  const endDate = new Date(match.date_utc);
  endDate.setHours(endDate.getHours() + 2);
  const dtend = formatDateToICS(endDate.toISOString());
  const stageLabel = (match.stage || 'MATCH').toUpperCase();
  const groupLabel = match.group ? ` Grupo ${match.group}` : '';
  const summary = `[Largotek] ${match.home_team} vs ${match.away_team} - ${stageLabel}${groupLabel}`;
  const location = `${match.stadium}, ${match.city}, ${match.country}`.replace(/,/g, '\\,');
  const description = [
    'Calendario generado por Largotek SRL.',
    'Partido del Mundial 2026.',
    `Fase: ${match.stage || 'n/a'}${match.group ? ', Grupo ' + match.group : ''}.`,
    'Más info en https://largotek.com'
  ].join('\\n');

  ics += 'BEGIN:VEVENT\r\n';
  ics += `UID:${uid}\r\n`;
  ics += `DTSTAMP:${now}\r\n`;
  ics += `SUMMARY:${summary}\r\n`;
  ics += `DTSTART:${dtstart}\r\n`;
  ics += `DTEND:${dtend}\r\n`;
  ics += `LOCATION:${location}\r\n`;
  ics += `DESCRIPTION:${description}\r\n`;
  ics += 'STATUS:CONFIRMED\r\n';
  ics += 'TRANSP:OPAQUE\r\n';
  ics += 'END:VEVENT\r\n';
}

ics += 'END:VCALENDAR\r\n';

fs.writeFileSync('./worldcup2026_largotek_all.ics', ics, 'utf8');
console.log('✅ ICS generado: worldcup2026_largotek_all.ics');
