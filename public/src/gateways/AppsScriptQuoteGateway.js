import { fileToBase64 } from '../core/base64.js';
import { QuoteGateway } from './QuoteGateway.js';

const TIMEOUT_MS = 120_000;

// Invia la richiesta all'app web di Google Apps Script (apps-script/Code.gs), che salva i file su Drive
// e scrive via Gmail a noi e al cliente. Ogni errore diventa un'eccezione: QuoteService lo trasforma in "riprova".
export class AppsScriptQuoteGateway extends QuoteGateway {
  #endpoint;

  constructor({ endpoint }) {
    super();
    this.#endpoint = endpoint;
  }

  async submit(request) {
    const files = await Promise.all(request.files.map(async (file) => ({ name: file.name, data: await fileToBase64(file) })));
    const payload = {
      mode: request.mode,
      name: request.name,
      email: request.email,
      description: request.description,
      materialId: request.materialId,
      materialLabel: request.materialLabel,
      customMaterial: request.customMaterial,
      quantity: request.quantity,
      deadline: request.deadline,
      workId: request.workId,
      workTitle: request.workTitle,
      lang: request.lang,
      privacyAccepted: request.privacyAccepted,
      files,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // text/plain: è una "richiesta semplice", il browser non manda il preflight che Apps Script non gestisce.
      const response = await fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? `http ${response.status}`);
      return { reference: result.reference, simulated: false, filesReceived: files.length };
    } finally {
      clearTimeout(timer);
    }
  }
}
