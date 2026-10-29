import { renderInto } from '../core/dom.js';
import { consentView, footerView, headerView } from '../views/ShellView.js';

// Cornice del sito: intestazione, piè di pagina e banner. Vive fuori dalle pagine e le sopravvive.
export class ShellController {
  #deps;
  #path = '/';

  constructor(deps) {
    this.#deps = deps;
    document.addEventListener('click', (event) => this.#onClick(event));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.#closeMenu();
    });
  }

  update(path = this.#path) {
    this.#path = path;
    const { i18n, theme, store } = this.#deps;
    const t = i18n.t.bind(i18n);
    const skip = document.querySelector('.skip-link');
    if (skip) skip.textContent = t('a11y.skip');
    renderInto(document.getElementById('app-header'), headerView({ t, lang: i18n.lang, theme: theme.theme, path }));
    renderInto(document.getElementById('app-footer'), footerView({ t }));
    renderInto(document.getElementById('app-consent'), store.consent ? '' : consentView({ t }));
    document.documentElement.classList.remove('menu-open');
  }

  #closeMenu() {
    document.documentElement.classList.remove('menu-open');
    document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
  }

  #onClick(event) {
    const { i18n, theme, store } = this.#deps;
    const target = event.target;
    const lang = target.closest('[data-lang]');
    if (lang) {
      i18n.set(lang.dataset.lang);
      return;
    }
    if (target.closest('[data-theme-toggle]')) {
      theme.toggle();
      this.update();
      return;
    }
    const menu = target.closest('[data-menu-toggle]');
    if (menu) {
      const open = document.documentElement.classList.toggle('menu-open');
      menu.setAttribute('aria-expanded', String(open));
      return;
    }
    const consent = target.closest('[data-consent]');
    if (consent) {
      store.setConsent(consent.dataset.consent);
      // La scelta di tema e lingua fatta finora segue il permesso appena dato.
      store.set('theme', theme.theme);
      store.set('lang', i18n.lang);
      this.update();
      return;
    }
    if (target.closest('.site-nav a')) this.#closeMenu();
  }
}
