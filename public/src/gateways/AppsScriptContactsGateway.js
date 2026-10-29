import { ContactsError, ContactsGateway } from './ContactsGateway.js';

const TIMEOUT_MS = 30_000;
const CODES = { key: 'key', locked: 'locked', not_configured: 'notConfigured', not_found: 'notFound' };

// Parla con l'app web di Apps Script (apps-script/Code.gs) presentando la chiave dei contatti.
// Usa POST con testo semplice: la chiave non finisce mai in un indirizzo, e il browser non fa il preflight.
export class AppsScriptContactsGateway extends ContactsGateway {
  #endpoint;
  #key;

  constructor({ endpoint, key }) {
    super();
    this.#endpoint = endpoint;
    this.#key = key;
  }

  get configured() {
    return Boolean(this.#endpoint && this.#key);
  }

  async list() {
    return (await this.#call({ action: 'list' })).contacts ?? [];
  }

  async update(reference, { status, note }) {
    await this.#call({ action: 'update', reference, status, note });
  }

  async remove(reference) {
    await this.#call({ action: 'delete', reference });
  }

  async #call(body) {
    if (!this.configured) throw new ContactsError('notConfigured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let result;
    try {
      const response = await fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, key: this.#key }),
        signal: controller.signal,
      });
      result = await response.json();
    } catch (error) {
      throw new ContactsError(error?.name === 'SyntaxError' ? 'server' : 'network');
    } finally {
      clearTimeout(timer);
    }
    if (!result?.ok) throw new ContactsError(CODES[result?.error] ?? 'server');
    return result;
  }
}
