import { render } from './html.js';

// La CSP vieta gli stili inline negli attributi: i valori dinamici (colori dei filamenti, percentuali)
// viaggiano come data-* e questa funzione li trasforma in variabili CSS dopo ogni render.
export function applyDynamicStyles(root) {
  root.querySelectorAll('[data-hex]').forEach((element) => {
    element.style.setProperty('--filament', element.dataset.hex);
    if (element.dataset.ink) element.style.setProperty('--filament-ink', element.dataset.ink);
  });
  root.querySelectorAll('[data-fill]').forEach((element) => {
    element.style.setProperty('--fill', element.dataset.fill);
    if (element.dataset.fillAfter) element.style.setProperty('--fill-after', element.dataset.fillAfter);
  });
}

export function renderInto(target, template) {
  render(target, template);
  applyDynamicStyles(target);
}

export function announce(message) {
  const live = document.getElementById('app-live');
  if (!live) return;
  live.textContent = '';
  window.setTimeout(() => { live.textContent = message; }, 50);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
