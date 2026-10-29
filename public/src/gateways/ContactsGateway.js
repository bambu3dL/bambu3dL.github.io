// Contratto di chi sa leggere e gestire le richieste di contatto ricevute dal modulo e i file che i clienti allegano. I dati
// dei clienti sono personali: stanno in un luogo privato (oggi un foglio e una cartella Google dietro Apps Script), mai nel
// repository pubblico.
//
//   configured                       -> true se ci sono indirizzo e chiave
//   list()                           -> [{ reference, receivedAt, status, name, email, ... }]
//   update(reference, {status,note}) -> void
//   remove(reference)                -> void
//   files(reference?)                -> { folder: {name,url,library}, files: [{id,name,size,updatedAt,url}], truncated }
//                                       senza riferimento: la Libreria (i file caricati da noi)
//   upload(reference?, files)        -> string[] i nomi salvati (files: File del browser)
//   trashFile(fileId)                -> void (nel cestino di Drive, ripristinabile)
//
// Gli errori sono ContactsError con un codice stabile.
export class ContactsGateway {
  get configured() { return false; }
  async list() { throw new Error('not implemented'); }
  async update() { throw new Error('not implemented'); }
  async remove() { throw new Error('not implemented'); }
  async files() { throw new Error('not implemented'); }
  async upload() { throw new Error('not implemented'); }
  async trashFile() { throw new Error('not implemented'); }
}

/** code: 'notConfigured' | 'key' | 'locked' | 'notFound' | 'badRequest' | 'files' | 'filesCount' | 'filesType' | 'filesSize' | 'filesTotal' | 'network' | 'server' */
export class ContactsError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ContactsError';
    this.code = code;
  }
}
