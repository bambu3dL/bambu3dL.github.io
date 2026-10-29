import { fileToBase64 } from '../core/base64.js';
import { ContactsError, ContactsGateway } from './ContactsGateway.js';

const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 180_000; // file grandi su una connessione lenta
const CODES = {
  key: 'key', locked: 'locked', not_configured: 'notConfigured', not_found: 'notFound', bad_request: 'badRequest',
  files: 'files', files_count: 'filesCount', files_type: 'filesType', files_size: 'filesSize', files_total: 'filesTotal',
};

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

  async files(reference = '') {
    const result = await this.#call({ action: 'files', reference });
    return { folder: result.folder, files: result.files ?? [], truncated: Boolean(result.truncated) };
  }

  async upload(reference, files) {
    const encoded = await Promise.all(files.map(async (file) => ({ name: file.name, data: await fileToBase64(file) })));
    return (await this.#call({ action: 'upload', reference, files: encoded }, UPLOAD_TIMEOUT_MS)).saved ?? [];
  }

  async trashFile(fileId) {
    await this.#call({ action: 'trash', fileId });
  }

  async #call(body, timeout = TIMEOUT_MS) {
    if (!this.configured) throw new ContactsError('notConfigured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
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
