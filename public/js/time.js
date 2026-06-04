// time.js — Los kickoffs en Firestore están guardados en hora local de la sede
// No aplicar conversión de zona para no sumar offset incorrecto
export const LOCALE = 'es-BO';

/**
 * Formatea una fecha en hora local del sistema (sin forzar zona).
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatLP(date, opts) {
  // Extraer componentes UTC del timestamp (que representa la hora local de la sede)
  const year   = date.getUTCFullYear();
  const month  = date.getUTCMonth();
  const day    = date.getUTCDate();
  const hour   = date.getUTCHours();
  const minute = date.getUTCMinutes();
  // Crear una fecha local con esos mismos valores para que toLocaleString no aplique offset
  const local  = new Date(year, month, day, hour, minute);
  return local.toLocaleString(LOCALE, opts);
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
