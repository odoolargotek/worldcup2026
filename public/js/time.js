// time.js — Helper central de zona horaria Bolivia (La Paz, UTC-4)
// Los kickoffs en Firestore están en UTC real → se convierten a America/La_Paz
export const TZ     = 'America/La_Paz';
export const LOCALE = 'es-BO';

const BASE = { timeZone: TZ };

export function formatLP(date, opts) {
  return date.toLocaleString(LOCALE, { ...BASE, ...opts });
}

/** Fecha corta: "jue, 11 jun" */
export function fmtDate(date) {
  return formatLP(date, { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '');
}

/** Hora en 12h: "3:00 p. m." */
export function fmtTime(date) {
  return formatLP(date, { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Fecha larga: "jueves, 11 de junio de 2026 · 3:00 p. m." */
export function fmtLong(date) {
  const d = formatLP(date, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const t = fmtTime(date);
  return `${d} · ${t}`;
}
