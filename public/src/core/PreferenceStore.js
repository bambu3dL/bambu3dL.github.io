// Memoria delle preferenze (tema, lingua) con scadenza.
// Con il permesso dell'utente vive in localStorage per mesi; senza, solo per la visita corrente (sessionStorage).
// Il formato { v, exp } è lo stesso letto da src/boot.js.

const PREFIX = 'stampe3d:';
const CONSENT_KEY = 'consent';
const DAY_MS = 24 * 60 * 60 * 1000;

function safe(action, fallback = null) {
  try {
    return action();
  } catch {
    return fallback;
  }
}

function readFrom(storage, key) {
  const raw = safe(() => storage.getItem(PREFIX + key));
  if (!raw) return null;
  const parsed = safe(() => JSON.parse(raw));
  if (!parsed || (parsed.exp && parsed.exp < Date.now())) {
    safe(() => storage.removeItem(PREFIX + key));
    return null;
  }
  return parsed.v;
}

export class PreferenceStore {
  constructor({ persistDays = 180 } = {}) {
    this.persistDays = persistDays;
  }

  /** 'persist' | 'session' | null (non ancora scelto). La scelta stessa resta sul dispositivo per un anno. */
  get consent() {
    const value = readFrom(window.localStorage, CONSENT_KEY);
    return value === 'persist' || value === 'session' ? value : null;
  }

  setConsent(mode) {
    const exp = Date.now() + 365 * DAY_MS;
    safe(() => window.localStorage.setItem(PREFIX + CONSENT_KEY, JSON.stringify({ v: mode, exp })));
    if (mode === 'session') this.#clearPersistent();
  }

  get(key) {
    return readFrom(window.localStorage, key) ?? readFrom(window.sessionStorage, key);
  }

  set(key, value) {
    const persistent = this.consent === 'persist';
    const record = JSON.stringify({ v: value, exp: persistent ? Date.now() + this.persistDays * DAY_MS : 0 });
    const target = persistent ? window.localStorage : window.sessionStorage;
    safe(() => target.setItem(PREFIX + key, record));
    // Una scelta fatta senza permesso non deve restare nel posto durevole.
    if (!persistent) safe(() => window.localStorage.removeItem(PREFIX + key));
  }

  #clearPersistent() {
    ['theme', 'lang'].forEach((key) => safe(() => window.localStorage.removeItem(PREFIX + key)));
  }
}
