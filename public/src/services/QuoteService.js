import { QuoteRequest } from '../models/QuoteRequest.js';

// Caso d'uso "invia un messaggio dal modulo di contatto": valida, scarta i bot, delega l'invio al gateway iniettato.
export class QuoteService {
  #gateway;

  constructor(gateway) {
    this.#gateway = gateway;
  }

  async submit(fields) {
    const request = new QuoteRequest(fields);
    const errors = request.validate();
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    if (request.looksAutomated) return { ok: true, reference: 'Q-00000', simulated: true, filesReceived: 0 };
    try {
      const result = await this.#gateway.submit(request);
      return { ok: true, ...result };
    } catch {
      return { ok: false, errors: {}, failed: true };
    }
  }
}
