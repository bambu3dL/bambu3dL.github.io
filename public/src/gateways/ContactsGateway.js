// Contratto di chi sa leggere e gestire le richieste di contatto ricevute dal modulo. I dati dei clienti sono
// personali: stanno in un luogo privato (oggi un foglio Google dietro Apps Script), mai nel repository pubblico.
//
//   configured                       -> true se ci sono indirizzo e chiave
//   list()                           -> [{ reference, receivedAt, status, name, email, ... }]
//   update(reference, {status,note}) -> void
//   remove(reference)                -> void
//
// Gli errori sono ContactsError con un codice stabile.
export class ContactsGateway {
  get configured() { return false; }
  async list() { throw new Error('not implemented'); }
  async update() { throw new Error('not implemented'); }
  async remove() { throw new Error('not implemented'); }
}

/** code: 'notConfigured' | 'key' | 'locked' | 'notFound' | 'network' | 'server' */
export class ContactsError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ContactsError';
    this.code = code;
  }
}
