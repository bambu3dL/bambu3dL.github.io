// Lingua corrente e traduzioni. I dizionari si registrano dall'esterno: il servizio non importa lingue.

const LANGS = ['it', 'en'];

function lookup(dictionary, path) {
  return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), dictionary);
}

export class I18nService {
  #store;
  #dictionaries = {};
  #listeners = new Set();

  constructor(store, dictionaries) {
    this.#store = store;
    this.#dictionaries = dictionaries;
  }

  get lang() {
    const current = document.documentElement.getAttribute('lang');
    return LANGS.includes(current) ? current : 'it';
  }

  get languages() {
    return LANGS;
  }

  set(lang) {
    if (!LANGS.includes(lang) || lang === this.lang) return;
    document.documentElement.setAttribute('lang', lang);
    this.#store.set('lang', lang);
    this.#listeners.forEach((listener) => listener(lang));
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Traduce una chiave a punti. {nome} nelle stringhe viene sostituito dalle variabili. */
  t(key, vars = {}) {
    const value = lookup(this.#dictionaries[this.lang], key) ?? lookup(this.#dictionaries.it, key);
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
  }

  /** Per le liste di testi (passi, paragrafi) che nei dizionari sono array. */
  list(key) {
    const value = lookup(this.#dictionaries[this.lang], key) ?? lookup(this.#dictionaries.it, key);
    return Array.isArray(value) ? value : [];
  }

  grams(value) {
    return `${new Intl.NumberFormat(this.lang).format(Math.round(value))} g`;
  }

  date(value) {
    return new Intl.DateTimeFormat(this.lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(value);
  }
}
