import { ValidationError, checkUploadFiles } from '../models/AdminRules.js';

// I file su Drive, visti dall'area riservata: la Libreria (quelli caricati da noi) e quelli di ogni richiesta (allegati dai
// clienti dal modulo del sito, più quelli che aggiungiamo noi). Il servizio non sa dove vivano: parla con il gateway che riceve.
export class FilesAdmin {
  #gateway;

  constructor(gateway) {
    this.#gateway = gateway;
  }

  /** `reference` vuoto = la Libreria. */
  async list(reference = '') {
    return this.#gateway.files(reference);
  }

  /** Ricontrolla formati e limiti prima di mandare qualcosa in rete; restituisce i nomi salvati. */
  async upload({ reference = '', files }) {
    const errors = checkUploadFiles(files);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    return this.#gateway.upload(reference, Array.from(files));
  }

  trash(fileId) {
    return this.#gateway.trashFile(fileId);
  }
}
