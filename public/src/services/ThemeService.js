// Tema chiaro/scuro: stato, persistenza e attributi sul documento.
const THEMES = ['dark', 'light'];
const THEME_COLORS = { dark: '#141311', light: '#ebebed' };

export class ThemeService {
  #store;
  #listeners = new Set();

  constructor(store) {
    this.#store = store;
  }

  get theme() {
    const current = document.documentElement.getAttribute('data-theme');
    return THEMES.includes(current) ? current : 'dark';
  }

  set(theme) {
    if (!THEMES.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    this.#store.set('theme', theme);
    this.#listeners.forEach((listener) => listener(theme));
  }

  toggle() {
    this.set(this.theme === 'dark' ? 'light' : 'dark');
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
