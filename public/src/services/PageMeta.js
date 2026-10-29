// Titolo e meta tag della pagina aperta: ciò che leggono i motori di ricerca e le anteprime dei link.
// Il sito è una pagina sola, quindi index.html porta i valori di base e questo servizio li aggiorna a ogni cambio di pagina.
const LOCALES = { it: 'it_IT', en: 'en_US' };

export class PageMeta {
  #document;
  #origin;

  constructor({ document: doc = document, origin = window.location.origin } = {}) {
    this.#document = doc;
    this.#origin = origin;
  }

  /** @param {{title: string, description: string, path: string, lang: string, siteName: string, noindex?: boolean}} page */
  apply({ title, description, path, lang, siteName, noindex = false }) {
    const url = this.#origin + (path === '/' ? '/' : path.replace(/\/+$/, ''));
    this.#document.title = title;
    this.#set('meta[name="description"]', 'meta', { name: 'description' }, description);
    this.#set('meta[property="og:title"]', 'meta', { property: 'og:title' }, title);
    this.#set('meta[property="og:description"]', 'meta', { property: 'og:description' }, description);
    this.#set('meta[property="og:url"]', 'meta', { property: 'og:url' }, url);
    this.#set('meta[property="og:site_name"]', 'meta', { property: 'og:site_name' }, siteName);
    this.#set('meta[property="og:locale"]', 'meta', { property: 'og:locale' }, LOCALES[lang] ?? LOCALES.it);
    this.#set('meta[property="og:image"]', 'meta', { property: 'og:image' }, `${this.#origin}/assets/og-image.png`);
    this.#set('meta[name="twitter:title"]', 'meta', { name: 'twitter:title' }, title);
    this.#set('meta[name="twitter:description"]', 'meta', { name: 'twitter:description' }, description);
    this.#set('link[rel="canonical"]', 'link', { rel: 'canonical' }, url, 'href');
    if (noindex) this.#set('meta[name="robots"]', 'meta', { name: 'robots' }, 'noindex, nofollow');
    else this.#document.head.querySelector('meta[name="robots"]')?.remove();
  }

  #set(selector, tag, attributes, value, attribute = 'content') {
    let element = this.#document.head.querySelector(selector);
    if (!element) {
      element = this.#document.createElement(tag);
      for (const [name, content] of Object.entries(attributes)) element.setAttribute(name, content);
      this.#document.head.append(element);
    }
    element.setAttribute(attribute, value);
  }
}
