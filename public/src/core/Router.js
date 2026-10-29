// Router a History API. Le rotte si registrano dall'esterno (aperto/chiuso): il router non conosce le pagine.

function compile(pattern) {
  const names = [];
  const source = pattern
    .replace(/\/+$/, '')
    .replace(/:([A-Za-z]+)/g, (_, name) => {
      names.push(name);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${source || ''}/?$`), names };
}

export class Router {
  #routes = [];
  #notFound = null;
  #listeners = new Set();

  add(pattern, factory) {
    this.#routes.push({ ...compile(pattern), factory });
    return this;
  }

  setNotFound(factory) {
    this.#notFound = factory;
    return this;
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start() {
    window.addEventListener('popstate', () => this.#resolve({ scroll: false }));
    document.addEventListener('click', (event) => this.#handleClick(event));
    return this.#resolve({ scroll: false });
  }

  navigate(path, { replace = false } = {}) {
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    return this.#resolve({ scroll: true });
  }

  refresh() {
    return this.#resolve({ scroll: false });
  }

  get location() {
    return new URL(window.location.href);
  }

  #handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.dataset.external !== undefined) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith('/assets/')) return;
    event.preventDefault();
    if (url.pathname + url.search === window.location.pathname + window.location.search && !url.hash) return;
    this.navigate(url.pathname + url.search + url.hash);
  }

  async #resolve({ scroll }) {
    const url = this.location;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    let match = null;
    for (const route of this.#routes) {
      const found = route.regex.exec(path);
      if (found) {
        const params = {};
        route.names.forEach((name, index) => { params[name] = decodeURIComponent(found[index + 1]); });
        match = { factory: route.factory, params };
        break;
      }
    }
    if (!match) match = { factory: this.#notFound, params: {} };
    for (const listener of this.#listeners) await listener({ ...match, url, scroll });
  }
}
