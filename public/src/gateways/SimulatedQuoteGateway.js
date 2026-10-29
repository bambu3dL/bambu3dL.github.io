import { QuoteGateway } from './QuoteGateway.js';

// Finché il backend non esiste, il modulo funziona ma non spedisce nulla: lo dichiara nel risultato,
// così la vista può dirlo apertamente al visitatore.
export class SimulatedQuoteGateway extends QuoteGateway {
  async submit(request) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    return { reference: `Q-${stamp}`, simulated: true, filesReceived: request.files.length };
  }
}
