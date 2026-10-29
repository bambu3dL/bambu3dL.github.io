import { html } from '../../core/html.js';

/** Il marchio: tre strati di una stampa, sempre più larghi, la forma di un oggetto che nasce. */
export function logoMark(className = 'logo-mark') {
  return html`<svg class="${className}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <rect x="12" y="6" width="16" height="7" rx="1.5" class="logo-top"/>
    <rect x="7" y="16" width="26" height="7" rx="1.5" class="logo-mid"/>
    <rect x="2" y="26" width="36" height="8" rx="1.5" class="logo-base"/>
  </svg>`;
}
