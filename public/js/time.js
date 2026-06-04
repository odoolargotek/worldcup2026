// time.js — Helper central de zona horaria Bolivia (La Paz, UTC-4)
export const TZ = 'America/La_Paz';
export const LOCALE = 'es-BO';

/**
 * Formatea una fecha forzando siempre America/La_Paz.
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatLP(date, opts) {
  return date.toLocaleString(LOCALE, { timeZone: TZ, ...opts });
}

/** Fecha corta: "jue 12 jun" */
export function fmtDate(date) {
  return formatLP(date, { weekday:'short', day:'2-digit', month:'short' }).replace(/\./g,'');
}

/** Hora: "19:00" */
export function fmtTime(date) {
  return formatLP(date, { hour:'2-digit', minute:'2-digit' });
}

/** Fecha larga: "jueves, 12 de junio de 2026 · 19:00" */
export function fmtLong(date) {
  const d = formatLP(date, { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const t = fmtTime(date);
  return `${d} · ${t}`;
}
