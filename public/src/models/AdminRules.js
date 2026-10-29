// Regole dei contenuti gestiti dall'area riservata: normalizzano e controllano ciò che arriva dai moduli.
// Funzioni pure, senza DOM e senza rete. Gli errori sono { campo: codice }; le viste li traducono.
import { ACCEPTED_EXTENSIONS, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, extensionOf } from './QuoteRequest.js';

/** Le forme 3D che il sito sa disegnare, con i parametri regolabili (solo finché non ci sono modelli reali). */
export const SHAPES = Object.freeze({
  twistVase: {
    fixed: { height: 1 },
    fields: [
      { name: 'lobes', min: 3, max: 12, step: 1, value: 6 },
      { name: 'twist', min: -5, max: 5, step: 0.1, value: 2 },
      { name: 'radius', min: 0.25, max: 0.4, step: 0.01, value: 0.34 },
      { name: 'waist', min: 0.05, max: 0.35, step: 0.01, value: 0.16 },
    ],
  },
  honeycomb: {
    fixed: {},
    fields: [
      { name: 'rings', min: 1, max: 3, step: 1, value: 2 },
      { name: 'baseHeight', min: 0.4, max: 0.9, step: 0.01, value: 0.62 },
      { name: 'variance', min: 0, max: 0.6, step: 0.01, value: 0.38 },
    ],
  },
  gear: {
    fixed: {},
    fields: [
      { name: 'teeth', min: 8, max: 40, step: 1, value: 16 },
      { name: 'thickness', min: 0.1, max: 0.4, step: 0.01, value: 0.28 },
      { name: 'hole', min: 0.1, max: 0.4, step: 0.01, value: 0.18 },
    ],
  },
});

const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FAMILY_CODE = /^[A-Z0-9][A-Z0-9+-]{0,11}$/;

const text = (value) => String(value ?? '').trim();
// Un campo vuoto non è zero: sarebbe un modo silenzioso di azzerare una bobina. Qui diventa NaN e fallisce i controlli.
const number = (value) => {
  const raw = String(value ?? '').trim().replace(',', '.');
  return raw === '' ? NaN : Number(raw);
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ValidationError extends Error {
  /** @param {Record<string,string>} errors campo -> codice */
  constructor(errors, detail = {}) {
    super('validation');
    this.name = 'ValidationError';
    this.errors = errors;
    this.detail = detail;
  }
}

/** "Rosso lampone!" -> "rosso-lampone". Senza accenti, minuscolo, al massimo 40 caratteri. */
export function slugify(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export function uniqueId(base, taken) {
  const root = base || 'voce';
  let candidate = root;
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${root}-${n}`;
  return candidate;
}

/** Colore del testo leggibile sopra `hex`: scuro sui colori chiari, bianco sugli scuri. */
export function inkFor(hex) {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1c1a15' : '#ffffff';
}

/* ---------- Fili (il catalogo) ---------- */

export function checkMaterial(input, { families, creating = false }) {
  const errors = {};
  if (!Object.hasOwn(families, text(input.family))) errors.family = 'family';
  if (text(input.nameIt).length < 2) errors.nameIt = 'required';
  if (text(input.brand).length > 40) errors.brand = 'name';
  if (!HEX.test(text(input.hex))) errors.hex = 'hex';
  const spool = number(input.spoolG);
  if (!Number.isFinite(spool) || spool < 1 || spool > 20000) errors.spoolG = 'range';
  if (creating) {
    const count = number(input.initialSpools);
    if (!Number.isInteger(count) || count < 0 || count > 10) errors.initialSpools = 'range';
  }
  return errors;
}

export function materialRecord(input, id) {
  const hex = text(input.hex).toLowerCase();
  const name = { it: text(input.nameIt) };
  if (text(input.nameEn)) name.en = text(input.nameEn);
  return {
    id,
    family: text(input.family),
    hex,
    ink: inkFor(hex),
    name,
    ...(text(input.brand) ? { brand: text(input.brand) } : {}),
    spoolG: Math.round(number(input.spoolG)),
  };
}

/* ---------- Bobine (i pezzi fisici) ---------- */

export function checkSpool(input, { materialIds }) {
  const errors = {};
  if (!materialIds.has(text(input.materialId))) errors.materialId = 'material';
  const net = number(input.netG);
  if (!Number.isFinite(net) || net < 1 || net > 20000) errors.netG = 'range';
  const left = number(input.remainingG);
  if (!Number.isFinite(left) || left < 0 || left > 20000) errors.remainingG = 'range';
  return errors;
}

export function spoolRecord(input, id, today) {
  return {
    id,
    materialId: text(input.materialId),
    netG: Math.round(number(input.netG)),
    remainingG: Math.round(number(input.remainingG)),
    status: 'active',
    addedAt: today,
  };
}

/** Una bobina nuova è la stessa cosa di un'altra: piena, in uso, con la data di oggi. */
export function newSpool(materialId, netG, id, today) {
  return spoolRecord({ materialId, netG, remainingG: netG }, id, today);
}

export function checkFamily(input) {
  const errors = {};
  if (!FAMILY_CODE.test(text(input.code).toUpperCase())) errors.code = 'code';
  if (text(input.it).length < 5) errors.it = 'required';
  return errors;
}

/* ---------- Opere ---------- */

export function shapeFrom(kind, values = {}) {
  const preset = SHAPES[kind];
  const shape = { kind, ...preset.fixed };
  preset.fields.forEach((field) => {
    const raw = number(values[field.name]);
    shape[field.name] = Number.isFinite(raw) && values[field.name] !== '' ? clamp(raw, field.min, field.max) : field.value;
  });
  return shape;
}

export function checkWork(input, { materialIds }) {
  const errors = {};
  if (text(input.titleIt).length < 2) errors.titleIt = 'required';
  if (text(input.summaryIt).length < 5) errors.summaryIt = 'required';
  if (!materialIds.has(text(input.materialId))) errors.materialId = 'material';
  const grams = number(input.estimatedG);
  if (!Number.isFinite(grams) || grams < 1 || grams > 20000) errors.estimatedG = 'range';
  const dims = [input.dimW, input.dimD, input.dimH].map(text);
  const filled = dims.filter(Boolean).length;
  if (filled !== 0 && (filled !== 3 || dims.some((value) => !(number(value) > 0 && number(value) <= 2000)))) errors.dimensions = 'dimensions';
  if (!DATE.test(text(input.date)) || Number.isNaN(new Date(text(input.date)).getTime())) errors.date = 'date';
  if (!Object.hasOwn(SHAPES, text(input.kind))) errors.kind = 'kind';
  return errors;
}

export function workRecord(input, id, { photo = '' } = {}) {
  const title = { it: text(input.titleIt) };
  if (text(input.titleEn)) title.en = text(input.titleEn);
  const summary = { it: text(input.summaryIt) };
  if (text(input.summaryEn)) summary.en = text(input.summaryEn);
  const dims = [input.dimW, input.dimD, input.dimH].map(text);
  return {
    id,
    date: text(input.date),
    shape: shapeFrom(text(input.kind), input.shape),
    materialId: text(input.materialId),
    estimatedG: Math.round(number(input.estimatedG)),
    ...(dims.every(Boolean) ? { dimensionsMm: dims.map((value) => Math.round(number(value))) } : {}),
    title,
    summary,
    ...(photo ? { photo } : {}),
    ...(input.visible === false ? { visible: false } : {}),
  };
}

/* ---------- Magazzino e impostazioni ---------- */

export function checkStockChange({ mode, grams }) {
  const errors = {};
  if (!['set', 'add', 'subtract'].includes(mode)) errors.mode = 'mode';
  const value = number(grams);
  if (!Number.isFinite(value) || value < 0 || value > 100000) errors.grams = 'range';
  return errors;
}

/** Il nuovo residuo dopo un movimento; mai sotto zero. */
export function applyStockChange(current, { mode, grams }) {
  const value = Math.round(number(grams));
  if (mode === 'set') return Math.max(0, value);
  if (mode === 'add') return Math.max(0, current + value);
  return Math.max(0, current - value);
}

/** I file da caricare su Drive dall'area riservata: stessi formati e limiti del modulo del sito. `files` ha { name, size }. */
export function checkUploadFiles(files) {
  const list = Array.from(files ?? []);
  if (list.length === 0) return { files: 'filesNone' };
  if (list.length > MAX_FILES) return { files: 'filesCount' };
  if (list.some((file) => !ACCEPTED_EXTENSIONS.includes(extensionOf(file.name)))) return { files: 'filesType' };
  if (list.some((file) => file.size > MAX_FILE_BYTES)) return { files: 'filesSize' };
  if (list.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return { files: 'filesTotal' };
  return {};
}

export function checkSettings(input) {
  const errors = {};
  if (text(input.name).length < 2 || text(input.name).length > 40) errors.name = 'name';
  if (text(input.contactEmail) && !EMAIL.test(text(input.contactEmail))) errors.contactEmail = 'email';
  return errors;
}

export function settingsRecord(input) {
  return { name: text(input.name), contactEmail: text(input.contactEmail) };
}

/* ---------- Contatti (richieste dal modulo) ---------- */

/** Gli stati di una richiesta, nell'ordine in cui di solito si attraversano. 'closed' = chiusa, senza altro da fare. */
export const CONTACT_STATUSES = Object.freeze(['received', 'reviewing', 'quoted', 'confirmed', 'printing', 'ready', 'closed']);

export function checkContactUpdate({ status, note }) {
  const errors = {};
  if (!CONTACT_STATUSES.includes(text(status))) errors.status = 'mode';
  if (text(note).length > 1000) errors.note = 'range';
  return errors;
}
