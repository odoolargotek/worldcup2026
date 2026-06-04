// time.js — Helper central de zona horaria Bolivia (La Paz, UTC-4)
// Siempre fuerza America/La_Paz Y formato 24h (hour12:false)
export const TZ     = 'America/La_Paz';
export const LOCALE = 'es-BO';

const BASE = { timeZone: TZ, hour12: false, hourCycle: 'h23' };

/**
 * Formatea una fecha forzando America/La_Paz + 24h.
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatLP(date, opts) {
  return date.toLocaleString(LOCALE, { ...BASE, ...opts });
}

/** Fecha corta: "jue, 11 jun" */
export function fmtDate(date) {
  return formatLP(date, { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '');
}

/** Hora en 24h: "19:00" */
export function fmtTime(date) {
  return formatLP(date, { hour: '2-digit', minute: '2-digit' });
}

/** Fecha larga: "jueves, 11 de junio de 2026 · 19:00" */
export function fmtLong(date) {
  const d = formatLP(date, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const t = fmtTime(date);
  return `${d} · ${t}`;
}
