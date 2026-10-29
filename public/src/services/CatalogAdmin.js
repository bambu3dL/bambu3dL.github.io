import {
  MODEL_KIND,
  ValidationError,
  checkHome,
  colorsOfRecord,
  homeRecord,
  applyStockChange,
  checkFamily,
  checkMaterial,
  checkSettings,
  checkSpool,
  checkStockChange,
  checkWork,
  materialRecord,
  newSpool,
  settingsRecord,
  slugify,
  spoolRecord,
  uniqueId,
  workRecord,
} from '../models/AdminRules.js';

// Contenuti del sito che l'area riservata può cambiare. Sono file JSON nel repository: questo servizio li legge,
// li modifica e li riscrive tramite il ContentGateway che riceve (non sa che dietro c'è GitHub).
// Ogni scrittura rilegge il file un istante prima, così non cancella modifiche fatte nel frattempo da altrove.
//
// Un FILO è una voce del catalogo (famiglia, colore, marca); una BOBINA è un pezzo fisico di quel filo con i suoi
// grammi residui. Un filo può avere più bobine; il residuo del filo è la somma di quelle in uso.

const FILES = Object.freeze({
  materials: 'assets/data/materials.json',
  spools: 'assets/data/spools.json',
  works: 'assets/data/works.json',
  site: 'assets/data/site.json',
  log: 'assets/data/stock-log.json',
});
const MAX_LOG_ENTRIES = 300;
const today = () => new Date().toISOString().slice(0, 10);

/** Le bobine in uso di un filo, dalla più vecchia: si consumano in quest'ordine. */
const oldestFirst = (a, b) => String(a.addedAt).localeCompare(String(b.addedAt)) || a.id.localeCompare(b.id, 'it', { numeric: true });
const inUse = (spool) => spool.status !== 'finished';

export class CatalogAdmin {
  #gateway;

  constructor(gateway) {
    this.#gateway = gateway;
  }

  /* ---------- Lettura ---------- */

  async materials() {
    const [{ data }, { data: spoolData }] = await Promise.all([this.#materialsFile(), this.#spoolsFile()]);
    return { materials: data.materials, families: data.families, spools: spoolData.spools };
  }

  /** Nell'ordine in cui compaiono nel sito: lo decide l'admin (moveWork), i nuovi vanno in cima. */
  async works() {
    const { data } = await this.#worksFile();
    return [...data.works];
  }

  /** Le scelte per la home: { hero, featured } (vuoto = automatico). */
  async home() {
    const { data } = await this.#gateway.readJson(FILES.site);
    return { hero: data?.home?.hero ?? '', featured: Array.isArray(data?.home?.featured) ? data.home.featured : [] };
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

  /* ---------- Fili e famiglie ---------- */

  /** Alla creazione, `initialSpools` bobine nuove e piene vengono aggiunte da sole. */
  async saveMaterial(input, { id = null } = {}) {
    const { data, sha } = await this.#materialsFile();
    const errors = checkMaterial(input, { families: data.families, creating: !id });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const index = id ? data.materials.findIndex((item) => item.id === id) : -1;
    if (id && index < 0) throw new ValidationError({ id: 'missing' });
    const recordId = id ?? uniqueId(slugify(`${input.family}-${input.nameIt}`), new Set(data.materials.map((item) => item.id)));
    const record = materialRecord(input, recordId);
    if (index >= 0) data.materials[index] = record;
    else data.materials.push(record);
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: ${index >= 0 ? 'aggiorna' : 'aggiungi'} il filo ${record.family} ${record.name.it}` });

    const count = index >= 0 ? 0 : Math.round(Number(input.initialSpools));
    if (count > 0) {
      const { data: spoolData, sha: spoolSha } = await this.#spoolsFile();
      const taken = new Set(spoolData.spools.map((spool) => spool.id));
      for (let k = 0; k < count; k += 1) {
        const spoolId = uniqueId(`${recordId}-${spoolData.spools.filter((spool) => spool.materialId === recordId).length + 1}`, taken);
        taken.add(spoolId);
        spoolData.spools.push(newSpool(recordId, record.spoolG, spoolId, today()));
      }
      await this.#gateway.writeJson(FILES.spools, spoolData, { sha: spoolSha, message: `Admin: ${count === 1 ? 'una bobina nuova' : `${count} bobine nuove`} di ${record.family} ${record.name.it}` });
    }
    return record;
  }

  async deleteMaterial(id) {
    const { data, sha } = await this.#materialsFile();
    const material = data.materials.find((item) => item.id === id);
    if (!material) throw new ValidationError({ id: 'missing' });
    const users = (await this.#worksFile()).data.works.filter((work) => colorsOfRecord(work).some((color) => color.materialId === id));
    if (users.length) throw new ValidationError({ id: 'inUse' }, { works: users.map((work) => work.title.it) });
    const { data: spoolData, sha: spoolSha } = await this.#spoolsFile();
    const own = spoolData.spools.filter((spool) => spool.materialId === id);
    if (own.some(inUse)) throw new ValidationError({ id: 'hasSpools' });

    data.materials = data.materials.filter((item) => item.id !== id);
    await this.#gateway.writeJson(FILES.materials, data, { sha, message: `Admin: elimina il filo ${material.family} ${material.name.it}` });
    if (own.length) {
      spoolData.spools = spoolData.spools.filter((spool) => spool.materialId !== id);
      await this.#gateway.writeJson(FILES.spools, spoolData, { sha: spoolSha, message: `Admin: elimina le bobine finite di ${material.family} ${material.name.it}` });
    }
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

  /* ---------- Oggetti (le opere in vetrina) ---------- */

  /**
   * `photo` è { base64 } di un JPEG già ridimensionato; `removePhoto` toglie quella esistente.
   * `model` è { base64 } di un file .s3dm (vedi ModelImporter): se manca e l'oggetto ha già un modello, resta quello.
   */
  async saveWork(input, { id = null, photo = null, removePhoto = false, model = null } = {}) {
    const { data: materialData } = await this.#materialsFile();
    const { data, sha } = await this.#worksFile();
    const index = id ? data.works.findIndex((item) => item.id === id) : -1;
    if (id && index < 0) throw new ValidationError({ id: 'missing' });
    const previousModel = index >= 0 && data.works[index].shape?.kind === MODEL_KIND ? data.works[index].shape.url ?? '' : '';
    const errors = checkWork(input, { materialIds: new Set(materialData.materials.map((item) => item.id)), hasModel: Boolean(model) || Boolean(previousModel) });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const recordId = id ?? uniqueId(slugify(input.titleIt), new Set(data.works.map((item) => item.id)));
    const previous = index >= 0 ? data.works[index].photo ?? '' : '';

    let modelPath = String(input.kind).trim() === MODEL_KIND ? previousModel : '';
    if (model && String(input.kind).trim() === MODEL_KIND) {
      modelPath = `assets/models/${recordId}-${Date.now().toString(36)}.s3dm`;
      await this.#gateway.writeFile(modelPath, model.base64, { message: `Admin: modello 3D di ${input.titleIt}` });
    }

    let photoPath = removePhoto ? '' : previous;
    if (photo) {
      photoPath = `assets/uploads/${recordId}-${Date.now().toString(36)}.jpg`;
      await this.#gateway.writeFile(photoPath, photo.base64, { message: `Admin: foto di ${input.titleIt}` });
    }
    const record = workRecord(input, recordId, { photo: photoPath, modelPath });
    if (index >= 0) data.works[index] = record;
    else data.works.unshift(record);
    await this.#gateway.writeJson(FILES.works, data, { sha, message: `Admin: ${index >= 0 ? 'aggiorna' : 'aggiungi'} l’oggetto ${record.title.it}` });

    if (previous && previous !== photoPath) await this.#removeQuietly(previous, `Admin: toglie la vecchia foto di ${record.title.it}`);
    if (previousModel && previousModel !== modelPath) await this.#removeQuietly(previousModel, `Admin: toglie il vecchio modello 3D di ${record.title.it}`);
    return record;
  }

  async deleteWork(id) {
    const { data, sha } = await this.#worksFile();
    const work = data.works.find((item) => item.id === id);
    if (!work) throw new ValidationError({ id: 'missing' });
    data.works = data.works.filter((item) => item.id !== id);
    await this.#gateway.writeJson(FILES.works, data, { sha, message: `Admin: elimina l’oggetto ${work.title.it}` });
    await this.#forgetInHome(id);
    if (work.photo) await this.#removeQuietly(work.photo, `Admin: toglie la foto di ${work.title.it}`);
    if (work.shape?.kind === MODEL_KIND && work.shape.url) await this.#removeQuietly(work.shape.url, `Admin: toglie il modello 3D di ${work.title.it}`);
  }

  /** Sposta un oggetto di un posto nell'elenco del sito (`direction` 'up' = più in alto). */
  async moveWork(id, direction) {
    const { data, sha } = await this.#worksFile();
    const index = data.works.findIndex((item) => item.id === id);
    if (index < 0) throw new ValidationError({ id: 'missing' });
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= data.works.length) return false;
    [data.works[index], data.works[target]] = [data.works[target], data.works[index]];
    await this.#gateway.writeJson(FILES.works, data, { sha, message: `Admin: sposta l’oggetto ${data.works[target].title.it}` });
    return true;
  }

  /** L'oggetto che si stampa scorrendo la home e quelli in evidenza. Tutto vuoto = automatico. */
  async saveHome({ hero = '', featured = [] }) {
    const { data: worksData } = await this.#worksFile();
    const errors = checkHome({ hero, featured }, { workIds: new Set(worksData.works.map((item) => item.id)) });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#gateway.readJson(FILES.site);
    const next = { ...(data ?? {}) };
    const record = homeRecord({ hero, featured });
    if (record) next.home = record;
    else delete next.home;
    await this.#gateway.writeJson(FILES.site, next, { sha, message: 'Admin: aggiorna la home page' });
  }

  /* ---------- Bobine ---------- */

  /** Una bobina nuova. `remainingG` vale `netG` se non lo dici (bobina piena). */
  async addSpool({ materialId, netG, remainingG }) {
    const { data: materialData } = await this.#materialsFile();
    const input = { materialId, netG, remainingG: remainingG === undefined || remainingG === '' ? netG : remainingG };
    const errors = checkSpool(input, { materialIds: new Set(materialData.materials.map((item) => item.id)) });
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const { data, sha } = await this.#spoolsFile();
    const id = uniqueId(`${materialId}-${data.spools.filter((spool) => spool.materialId === materialId).length + 1}`, new Set(data.spools.map((spool) => spool.id)));
    const record = spoolRecord(input, id, today());
    if (record.remainingG === 0) record.status = 'finished';
    data.spools.push(record);
    await this.#gateway.writeJson(FILES.spools, data, { sha, message: `Admin: bobina nuova ${id} (${record.remainingG} g)` });
    await this.#appendLog([{ at: new Date().toISOString(), materialId, spoolId: id, before: 0, after: record.remainingG, reason: 'Bobina nuova' }]);
    return record;
  }

  /** mode: 'set' (il residuo diventa questo valore), 'add' (se ne aggiunge), 'subtract' (se n'è usato). */
  async adjustSpool({ spoolId, mode, grams, reason = '' }) {
    const errors = checkStockChange({ mode, grams });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#spoolsFile();
    const spool = data.spools.find((item) => item.id === spoolId);
    if (!spool) throw new ValidationError({ spoolId: 'missing' });

    const before = spool.remainingG;
    spool.remainingG = applyStockChange(before, { mode, grams });
    spool.status = spool.remainingG > 0 ? 'active' : 'finished'; // a zero la bobina è finita; con grammi in più si riapre
    await this.#gateway.writeJson(FILES.spools, data, { sha, message: `Admin: bobina ${spoolId}, da ${before} g a ${spool.remainingG} g` });
    await this.#appendLog([{ at: new Date().toISOString(), materialId: spool.materialId, spoolId, before, after: spool.remainingG, reason: String(reason).trim().slice(0, 120) }]);
    return { before, after: spool.remainingG };
  }

  /** Chiude una bobina anche se ci sono ancora grammi (un avanzo che non userai) o la riapre. */
  async setSpoolStatus(spoolId, status) {
    if (!['active', 'finished'].includes(status)) throw new ValidationError({ status: 'mode' });
    const { data, sha } = await this.#spoolsFile();
    const spool = data.spools.find((item) => item.id === spoolId);
    if (!spool) throw new ValidationError({ spoolId: 'missing' });
    spool.status = status;
    await this.#gateway.writeJson(FILES.spools, data, { sha, message: `Admin: bobina ${spoolId} ${status === 'finished' ? 'finita' : 'riaperta'}` });
    await this.#appendLog([{ at: new Date().toISOString(), materialId: spool.materialId, spoolId, before: spool.remainingG, after: spool.remainingG, reason: status === 'finished' ? 'Bobina finita' : 'Bobina riaperta' }]);
  }

  async deleteSpool(spoolId) {
    const { data, sha } = await this.#spoolsFile();
    const spool = data.spools.find((item) => item.id === spoolId);
    if (!spool) throw new ValidationError({ spoolId: 'missing' });
    data.spools = data.spools.filter((item) => item.id !== spoolId);
    await this.#gateway.writeJson(FILES.spools, data, { sha, message: `Admin: elimina la bobina ${spoolId}` });
  }

  /**
   * Toglie `grams` da un filo, partendo dalla bobina in uso più vecchia e passando alla successiva quando si svuota.
   * Se non basta, toglie quel che c'è e dice quanto è mancato (`shortfallG`).
   */
  async consume({ materialId, grams, reason = '' }) {
    const errors = checkStockChange({ mode: 'subtract', grams });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#spoolsFile();
    const own = data.spools.filter((spool) => spool.materialId === materialId);
    if (!own.length && !(await this.#materialsFile()).data.materials.some((item) => item.id === materialId)) throw new ValidationError({ materialId: 'missing' });

    const beforeG = own.filter(inUse).reduce((sum, spool) => sum + spool.remainingG, 0);
    let left = Math.round(Number(grams));
    const parts = [];
    for (const spool of own.filter(inUse).filter((item) => item.remainingG > 0).sort(oldestFirst)) {
      if (left <= 0) break;
      const taken = Math.min(spool.remainingG, left);
      parts.push({ spoolId: spool.id, before: spool.remainingG, after: spool.remainingG - taken, taken });
      spool.remainingG -= taken;
      if (spool.remainingG === 0) spool.status = 'finished';
      left -= taken;
    }
    const takenG = parts.reduce((sum, part) => sum + part.taken, 0);
    if (parts.length) {
      await this.#gateway.writeJson(FILES.spools, data, { sha, message: `Admin: consumo di ${takenG} g di ${materialId}` });
      const at = new Date().toISOString();
      await this.#appendLog(parts.map((part) => ({ at, materialId, spoolId: part.spoolId, before: part.before, after: part.after, reason: String(reason).trim().slice(0, 120) })));
    }
    return { requestedG: Math.round(Number(grams)), takenG, shortfallG: left, beforeG, afterG: beforeG - takenG, parts };
  }

  /** Scala dal magazzino dei grammi liberi (una prova, uno scarto, una stampa fuori vetrina), senza passare da un oggetto. */
  async consumeGrams({ materialId, grams, reason = '' }) {
    const errors = {};
    if (!String(materialId ?? '').trim()) errors.materialId = 'missing';
    const value = Number(grams);
    if (grams === '' || grams === null || !Number.isFinite(value) || value < 1 || value > 100000) errors.grams = 'range';
    if (Object.keys(errors).length) throw new ValidationError(errors);
    return this.consume({ materialId, grams: Math.round(value), reason: String(reason ?? '').trim().slice(0, 120) || 'Grammi usati' });
  }

  /**
   * Scala dal magazzino il filamento stimato di un oggetto stampato `copies` volte, colore per colore.
   * Il risultato somma i colori (come un consumo solo) e tiene il dettaglio in `byColor`.
   */
  async consumeForWork({ workId, copies = 1 }) {
    const work = (await this.#worksFile()).data.works.find((item) => item.id === workId);
    if (!work) throw new ValidationError({ workId: 'missing' });
    const count = Math.max(1, Math.min(100, Math.floor(Number(copies)) || 1));
    const reason = `Stampa: ${work.title.it}${count > 1 ? ` × ${count}` : ''}`;
    const byColor = [];
    for (const color of colorsOfRecord(work)) {
      byColor.push({ materialId: color.materialId, result: await this.consume({ materialId: color.materialId, grams: color.grams * count, reason }) });
    }
    const sum = (key) => byColor.reduce((total, item) => total + item.result[key], 0);
    return {
      requestedG: sum('requestedG'),
      takenG: sum('takenG'),
      shortfallG: sum('shortfallG'),
      beforeG: sum('beforeG'),
      afterG: sum('afterG'),
      parts: byColor.flatMap((item) => item.result.parts),
      byColor,
    };
  }

  /* ---------- Impostazioni ---------- */

  async saveSettings(input) {
    const errors = checkSettings(input);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    const { data, sha } = await this.#gateway.readJson(FILES.site);
    // Si cambiano solo nome ed email: le scelte della home (e ciò che verrà) nello stesso file restano.
    await this.#gateway.writeJson(FILES.site, { ...(data ?? {}), ...settingsRecord(input) }, { sha, message: 'Admin: aggiorna le impostazioni del sito' });
  }

  /* ---------- Interni ---------- */

  async #materialsFile() {
    const { data, sha } = await this.#gateway.readJson(FILES.materials);
    return { data: { materials: [], families: {}, ...data }, sha };
  }

  async #spoolsFile() {
    const { data, sha } = await this.#gateway.readJson(FILES.spools);
    return { data: { spools: [], ...data }, sha };
  }

  async #worksFile() {
    const { data, sha } = await this.#gateway.readJson(FILES.works);
    return { data: { works: [], ...data }, sha };
  }

  async #appendLog(newEntries) {
    const { data, sha } = await this.#gateway.readJson(FILES.log);
    const entries = [...(data?.entries ?? []), ...newEntries].slice(-MAX_LOG_ENTRIES);
    await this.#gateway.writeJson(FILES.log, { entries }, { sha, message: 'Admin: registra il movimento di magazzino' });
  }

  /** Cancellare una foto vecchia non deve far fallire il salvataggio dell'oggetto: se non riesce, resta un file in più. */
  /** Un oggetto eliminato non resta tra le scelte della home. */
  async #forgetInHome(id) {
    try {
      const { data, sha } = await this.#gateway.readJson(FILES.site);
      const home = data?.home;
      if (!home || (home.hero !== id && !(home.featured ?? []).includes(id))) return;
      const next = { ...data };
      const record = homeRecord({ hero: home.hero === id ? '' : home.hero, featured: (home.featured ?? []).filter((item) => item !== id) });
      if (record) next.home = record;
      else delete next.home;
      await this.#gateway.writeJson(FILES.site, next, { sha, message: 'Admin: toglie un oggetto eliminato dalla home' });
    } catch { /* la home ignora comunque gli oggetti che non esistono più */ }
  }

  async #removeQuietly(path, message) {
    try {
      const sha = await this.#gateway.shaOf(path);
      if (sha) await this.#gateway.remove(path, { sha, message });
    } catch { /* il file orfano non fa danni */ }
  }
}
