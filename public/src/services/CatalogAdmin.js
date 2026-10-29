import {
  ValidationError,
  applyStockChange,
  checkFamily,
  checkMaterial,
  checkSettings,
  checkStockChange,
  checkWork,
  materialRecord,
  settingsRecord,
  slugify,
  uniqueId,
  workRecord,
} from '../models/AdminRules.js';

// Contenuti del sito che l'area riservata può cambiare. Sono file JSON nel repository: questo servizio li legge,
// li modifica e li riscrive tramite il ContentGateway che riceve (non sa che dietro c'è GitHub).
// Ogni scrittura rilegge il file un istante prima, così non cancella modifiche fatte nel frattempo da altrove.

const FILES = Object.freeze({
  materials: 'assets/data/materials.json',
  works: 'assets/data/works.json',
  site: 'assets/data/site.json',
  log: 'assets/data/stock-log.json',
});
const MAX_LOG_ENTRIES = 300;

export class CatalogAdmin {
  #gateway;

  constructor(gateway) {
    this.#gateway = gateway;
  }

  /* ---------- Lettura ---------- */

  async materials() {
    const { data } = await this.#materialsFile();
    return { materials: data.materials, families: data.families };
  }

  async works() {
    const { data } = await this.#worksFile();
    return [...data.works].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async settings() {
    return (await this.#gateway.readJson(FILES.site)).data ?? {};
  }

  async stockLog() {
    const { data } = await this.#gateway.readJson(FILES.log);
    return (data?.entries ?? []).slice().reverse();
  }

  publishStatus() {
    return this.#gateway.latestPublish();
  }

  /* ---------- Materiali e famiglie ---------- */

  async saveMaterial(input, { id = null } = {}) {
    const { data, sha } = await this.#materialsFile();
    const errors = checkMaterial(input, { families: data.families });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const index = id ? data.materials.findIndex((item) => item.id === id) : -1;
    if (id && index < 0) throw new ValidationError({ id: 'missing' });
    const recordId = id ?? uniqueId(slugify(`${input.family}-${input.nameIt}`), new Set(data.materials.map((item) => item.id)));
    // Il residuo cambia solo da Magazzino, così ogni variazione lascia traccia: qui si fissa solo alla creazione.
    const record = materialRecord(index >= 0 ? { ...input, stockG: data.materials[index].stockG } : input, recordId);
    if (index >= 0) data.materials[index] = record;
    else data.materials.push(record);
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: ${index >= 0 ? 'aggiorna' : 'aggiungi'} il materiale ${record.family} ${record.name.it}` });
    return record;
  }

  async deleteMaterial(id) {
    const { data, sha } = await this.#materialsFile();
    const material = data.materials.find((item) => item.id === id);
    if (!material) throw new ValidationError({ id: 'missing' });
    const users = (await this.#worksFile()).data.works.filter((work) => work.materialId === id);
    if (users.length) throw new ValidationError({ id: 'inUse' }, { works: users.map((work) => work.title.it) });
    data.materials = data.materials.filter((item) => item.id !== id);
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: elimina il materiale ${material.family} ${material.name.it}` });
  }

  async saveFamily(input) {
    const errors = checkFamily(input);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#materialsFile();
    const code = String(input.code).trim().toUpperCase();
    const description = { it: String(input.it).trim() };
    if (String(input.en ?? '').trim()) description.en = String(input.en).trim();
    data.families[code] = description;
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: aggiorna la famiglia ${code}` });
  }

  async deleteFamily(code) {
    const { data, sha } = await this.#materialsFile();
    if (data.materials.some((item) => item.family === code)) throw new ValidationError({ code: 'inUse' });
    delete data.families[code];
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: elimina la famiglia ${code}` });
  }

  /* ---------- Opere ---------- */

  /** `photo` è { base64 } di un JPEG già ridimensionato; `removePhoto` toglie quella esistente. */
  async saveWork(input, { id = null, photo = null, removePhoto = false } = {}) {
    const { data: materialData } = await this.#materialsFile();
    const { data, sha } = await this.#worksFile();
    const errors = checkWork(input, { materialIds: new Set(materialData.materials.map((item) => item.id)) });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const index = id ? data.works.findIndex((item) => item.id === id) : -1;
    if (id && index < 0) throw new ValidationError({ id: 'missing' });
    const recordId = id ?? uniqueId(slugify(input.titleIt), new Set(data.works.map((item) => item.id)));
    const previous = index >= 0 ? data.works[index].photo ?? '' : '';

    let photoPath = removePhoto ? '' : previous;
    if (photo) {
      photoPath = `assets/uploads/${recordId}-${Date.now().toString(36)}.jpg`;
      await this.#gateway.writeFile(photoPath, photo.base64, { message: `Admin: foto di ${input.titleIt}` });
    }
    const record = workRecord(input, recordId, { photo: photoPath });
    if (index >= 0) data.works[index] = record;
    else data.works.push(record);
    await this.#gateway.writeJson(FILES.works, data, { sha, message: `Admin: ${index >= 0 ? 'aggiorna' : 'aggiungi'} l’opera ${record.title.it}` });

    if (previous && previous !== photoPath) await this.#removeQuietly(previous, `Admin: toglie la vecchia foto di ${record.title.it}`);
    return record;
  }

  async deleteWork(id) {
    const { data, sha } = await this.#worksFile();
    const work = data.works.find((item) => item.id === id);
    if (!work) throw new ValidationError({ id: 'missing' });
    data.works = data.works.filter((item) => item.id !== id);
    await this.#gateway.writeJson(FILES.works, data, { sha, message: `Admin: elimina l’opera ${work.title.it}` });
    if (work.photo) await this.#removeQuietly(work.photo, `Admin: toglie la foto di ${work.title.it}`);
  }

  /* ---------- Magazzino ---------- */

  /** mode: 'set' (il residuo diventa questo valore), 'add' (arriva filamento), 'subtract' (se n'è usato). */
  async adjustStock({ materialId, mode, grams, reason = '' }) {
    const errors = checkStockChange({ mode, grams });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#materialsFile();
    const material = data.materials.find((item) => item.id === materialId);
    if (!material) throw new ValidationError({ materialId: 'missing' });

    const before = material.stockG;
    material.stockG = applyStockChange(before, { mode, grams });
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: magazzino ${material.family} ${material.name.it}, da ${before} g a ${material.stockG} g` });
    await this.#appendLog({ at: new Date().toISOString(), materialId, before, after: material.stockG, reason: String(reason).trim().slice(0, 120) });
    return { before, after: material.stockG };
  }

  /** Scala dal magazzino il filamento stimato di un'opera stampata `copies` volte. */
  async consumeForWork({ workId, copies = 1 }) {
    const work = (await this.#worksFile()).data.works.find((item) => item.id === workId);
    if (!work) throw new ValidationError({ workId: 'missing' });
    const count = Math.max(1, Math.min(100, Math.floor(Number(copies)) || 1));
    return this.adjustStock({
      materialId: work.materialId,
      mode: 'subtract',
      grams: work.estimatedG * count,
      reason: `Stampa: ${work.title.it}${count > 1 ? ` × ${count}` : ''}`,
    });
  }

  /* ---------- Impostazioni ---------- */

  async saveSettings(input) {
    const errors = checkSettings(input);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { sha } = await this.#gateway.readJson(FILES.site);
    await this.#gateway.writeJson(FILES.site, settingsRecord(input), { sha, message: 'Admin: aggiorna le impostazioni del sito' });
  }

  /* ---------- Interni ---------- */

  async #materialsFile() {
    const { data, sha } = await this.#gateway.readJson(FILES.materials);
    return { data: { materials: [], families: {}, ...data }, sha };
  }

  async #worksFile() {
    const { data, sha } = await this.#gateway.readJson(FILES.works);
    return { data: { works: [], ...data }, sha };
  }

  async #appendLog(entry) {
    const { data, sha } = await this.#gateway.readJson(FILES.log);
    const entries = [...(data?.entries ?? []), entry].slice(-MAX_LOG_ENTRIES);
    await this.#gateway.writeJson(FILES.log, { entries }, { sha, message: 'Admin: registra il movimento di magazzino' });
  }

  /** Cancellare una foto vecchia non deve far fallire il salvataggio dell'opera: se non riesce, resta un file in più. */
  async #removeQuietly(path, message) {
    try {
      const sha = await this.#gateway.shaOf(path);
      if (sha) await this.#gateway.remove(path, { sha, message });
    } catch { /* il file orfano non fa danni */ }
  }
}
