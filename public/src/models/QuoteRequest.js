// Messaggio dal modulo di contatto: raccoglie i dati e li valida. Nessuna dipendenza dal DOM.
// (Il nome "Quote" è storico: il sito non parla più di prezzi né di preventivi.)

export const QUOTE_MODES = Object.freeze(['idea', 'file']);
export const ACCEPTED_EXTENSIONS = Object.freeze([
  'stl', '3mf', 'step', 'stp', 'iges', 'igs', 'obj', 'ply', 'amf', 'dwg', 'dxf',
  'sldprt', 'sldasm', 'f3d', 'f3z', 'ipt', 'iam', '3dm', 'prt', 'x_t', 'x_b', 'sat', 'fcstd', 'skp',
]);
// Limiti prudenti: i file viaggiano in un'unica richiesta verso Apps Script (apps-script/Code.gs ha gli stessi valori).
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const MAX_FILES = 5;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function extensionOf(name) {
  const dot = String(name).lastIndexOf('.');
  return dot < 0 ? '' : String(name).slice(dot + 1).toLowerCase();
}

export class QuoteRequest {
  constructor(fields = {}) {
    this.mode = QUOTE_MODES.includes(fields.mode) ? fields.mode : 'idea';
    this.name = String(fields.name ?? '').trim();
    this.email = String(fields.email ?? '').trim();
    this.description = String(fields.description ?? '').trim();
    this.materialId = String(fields.materialId ?? '').trim();
    this.materialLabel = String(fields.materialLabel ?? '').trim();
    this.customMaterial = String(fields.customMaterial ?? '').trim();
    this.quantity = Math.floor(Number(fields.quantity) || 1);
    this.deadline = String(fields.deadline ?? '').trim();
    this.workId = String(fields.workId ?? '').trim();
    this.workTitle = String(fields.workTitle ?? '').trim();
    this.lang = fields.lang === 'en' ? 'en' : 'it';
    this.files = Array.from(fields.files ?? []);
    this.privacyAccepted = Boolean(fields.privacyAccepted);
    this.honeypot = String(fields.honeypot ?? '');
  }

  /** Restituisce { campo: chiaveErrore } oppure un oggetto vuoto se tutto è valido. */
  validate() {
    const errors = {};
    if (this.name.length < 2) errors.name = 'name';
    if (!EMAIL.test(this.email)) errors.email = 'email';
    if (this.description.length < 10) errors.description = 'description';
    if (!this.materialId) errors.materialId = 'material';
    if (this.materialId === 'other' && this.customMaterial.length < 2) errors.customMaterial = 'customMaterial';
    if (this.quantity < 1 || this.quantity > 1000) errors.quantity = 'quantity';
    if (this.mode === 'file' && this.files.length === 0) errors.files = 'filesRequired';
    else if (this.files.length > MAX_FILES) errors.files = 'filesCount';
    else if (this.files.some((file) => !ACCEPTED_EXTENSIONS.includes(extensionOf(file.name)))) errors.files = 'filesType';
    else if (this.files.some((file) => file.size > MAX_FILE_BYTES)) errors.files = 'filesSize';
    else if (this.files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) errors.files = 'filesTotal';
    if (!this.privacyAccepted) errors.privacyAccepted = 'privacy';
    return errors;
  }

  /** Il campo-trappola per i bot: un visitatore vero non lo vede e non lo compila. */
  get looksAutomated() {
    return this.honeypot !== '';
  }
}
