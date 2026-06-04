// time.js — Los kickoffs en Firestore están en hora local de la sede (guardados como UTC)
// Forzamos UTC+0 para mostrar el valor exacto sin ningún offset
export const LOCALE = 'es-BO';

const BASE = { timeZone: 'UTC', hour12: false };

/**
 * Formatea una fecha forzando UTC (sin conversión de zona).
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatLP(date, opts) {
  return date.toLocaleString(LOCALE, { timeZone: 'UTC', ...opts });
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
