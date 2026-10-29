// Contratto del luogo dove vivono i contenuti del sito (dati JSON e immagini). I percorsi sono relativi alla
// cartella pubblicata, ad esempio "assets/data/works.json". Implementazione attuale: GitHubContentGateway.
//
//   verify()                                -> { repo, canWrite }
//   readJson(path)                          -> { data, sha }          (data è null se il file non esiste)
//   writeJson(path, data, { sha, message }) -> nuovo sha
//   writeFile(path, base64, { sha, message })
//   remove(path, { sha, message })
//   shaOf(path)                             -> sha oppure null
//   latestPublish()                         -> { status, conclusion, at } oppure null
//
// Gli errori sono ContentError con un codice stabile, mai il messaggio grezzo del servizio.
export class ContentGateway {
  async verify() { throw new Error('not implemented'); }
  async readJson() { throw new Error('not implemented'); }
  async writeJson() { throw new Error('not implemented'); }
  async writeFile() { throw new Error('not implemented'); }
  async remove() { throw new Error('not implemented'); }
  async shaOf() { throw new Error('not implemented'); }
  async latestPublish() { return null; }
}

/** code: 'auth' | 'forbidden' | 'notFound' | 'conflict' | 'rateLimit' | 'network' | 'unknown' */
export class ContentError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ContentError';
    this.code = code;
    this.status = status;
  }
}
