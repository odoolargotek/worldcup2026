/**
 * sponsor-config.js — Configuración CENTRALIZADA del patrocinador
 * ================================================================
 * Para cambiar de patrocinador solo edita este archivo.
 * Se replica automáticamente en todas las páginas.
 *
 * Campos:
 *   name        — Nombre del patrocinador
 *   tagline     — Slogan o texto secundario
 *   logoUrl     — URL del logo (externa o ruta /img/...)
 *   linkUrl     — URL al hacer clic en el banner ('' para sin link)
 *   accentColor — Color de acento del banner (hex)
 *   active      — false = ocultar todos los bloques de patrocinador
 */
export const SPONSOR = {
  name:        'Largotek',
  tagline:     'Soluciones Digitales',
  logoUrl:     'https://www.largotek.com/web/image/website/2/logo/www.largotek.com?unique=276cda1',
  linkUrl:     'https://www.largotek.com',
  accentColor: '#1D90C6',
  active:      true,
};

/**
 * injectSponsor()
 * Inyecta automáticamente navbar logo + hero banner en la página.
 * Llámalo desde cualquier HTML así:
 *
 *   <script type="module">
 *     import { injectSponsor } from './js/sponsor-config.js';
 *     injectSponsor();
 *   </script>
 */
export function injectSponsor() {
  if (!SPONSOR.active) {
    // Ocultar cualquier bloque existente
    document.querySelectorAll('.sponsor-banner, .sponsor-navbar-logo').forEach(el => el.remove());
    return;
  }

  // ── 1. NAVBAR LOGO ───────────────────────────────────────────
  const navbarBrand = document.querySelector('.navbar-brand');
  if (navbarBrand) {
    // Quitar logo anterior si existe
    const oldLogo = navbarBrand.querySelector('.sponsor-navbar-logo');
    if (oldLogo) oldLogo.remove();

    const img = document.createElement('img');
    img.className = 'sponsor-navbar-logo';
    img.src = SPONSOR.logoUrl;
    img.alt = SPONSOR.name;
    img.title = SPONSOR.name;
    img.style.cssText = 'height:34px;object-fit:contain;filter:brightness(1.1);flex-shrink:0;cursor:pointer;';
    if (SPONSOR.linkUrl) img.addEventListener('click', () => window.open(SPONSOR.linkUrl, '_blank'));
    navbarBrand.prepend(img);
  }

  // ── 2. HERO BANNER ───────────────────────────────────────────
  const existingBanner = document.querySelector('.sponsor-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.className = 'sponsor-banner';
  banner.innerHTML = `
    <div class="sponsor-banner-accent" style="background:${SPONSOR.accentColor}"></div>
    <img src="${SPONSOR.logoUrl}" alt="${SPONSOR.name}">
    <div class="sponsor-banner-body">
      <span class="sponsor-banner-name">${SPONSOR.name}</span>
      <span class="sponsor-banner-tagline">${SPONSOR.tagline}</span>
    </div>
    <div class="sponsor-banner-dot" style="background:${SPONSOR.accentColor}"></div>
  `;
  if (SPONSOR.linkUrl) {
    banner.style.cursor = 'pointer';
    banner.addEventListener('click', () => window.open(SPONSOR.linkUrl, '_blank'));
  }

  // Insertar después del navbar (o al inicio del body)
  const navbar = document.querySelector('nav.navbar');
  const legalBar = navbar?.nextElementSibling;
  if (legalBar) {
    legalBar.insertAdjacentElement('afterend', banner);
  } else if (navbar) {
    navbar.insertAdjacentElement('afterend', banner);
  } else {
    document.body.prepend(banner);
  }
}
