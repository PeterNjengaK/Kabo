import { escape as e } from './shared.js';
export function brand(name = 'Kabo') {
  return `<span class="brand-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 5c-11 0-19 8-19 19s8 19 19 19 19-8 19-19S35 5 24 5Z"/><path d="M16 12v24m0-11 17-13M16 25l17 11M9 30c6-15 15-21 25-20M13 39c1-12 10-23 26-22"/></svg></span><span class="brand-type"><span class="brand-name">${e(name)}</span><span class="brand-caption">CROCHET ATELIER</span></span>`;
}
