/**
 * Backend del modulo di contatto (Google Apps Script).
 * Riceve la richiesta dal sito, la ricontrolla, salva i file su Drive e scrive via Gmail a noi e al cliente.
 * Le istruzioni per metterlo in funzione sono in GUIDA-MESSA-ONLINE.md (parte 2).
 *
 * La cartella radice su Drive (DRIVE_FOLDER_ID) raccoglie le cartelle delle richieste, una per cliente, e una "Libreria"
 * per i file caricati da noi. Dall'area riservata, con la ADMIN_KEY, si elencano, si caricano e si mettono nel cestino.
 * I clienti possono solo allegare file al modulo di contatto: non leggono né cancellano nulla.
 *
 * Ogni richiesta finisce anche in un foglio Google privato (nel tuo Drive): da lì l'area riservata del sito la mostra,
 * ne cambia lo stato e la elimina, presentando la ADMIN_KEY. Nessun dato dei clienti sta nel repository pubblico.
 *
 * Funzioni da lanciare a mano dall'editor: inizializza() una volta, creaChiaveAdmin() una volta, prova() per un collaudo.
 * Impostazioni (Impostazioni progetto > Proprietà script): DRIVE_FOLDER_ID, SHEET_ID, OWNER_EMAILS, SITE_NAME, ADMIN_KEY.
 */

// Gli stessi limiti del sito (public/src/models/QuoteRequest.js): se li cambi, cambiali in entrambi i posti.
const LIMITS = {
  maxFiles: 5,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 30 * 1024 * 1024,
  perEmailPerHour: 3,
  allPerHour: 30,
};
const EXTENSIONS = [
  'stl', '3mf', 'step', 'stp', 'iges', 'igs', 'obj', 'ply', 'amf', 'dwg', 'dxf',
  'sldprt', 'sldasm', 'f3d', 'f3z', 'ipt', 'iam', '3dm', 'prt', 'x_t', 'x_b', 'sat', 'fcstd', 'skp',
];
const MODES = ['idea', 'file'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TIME_ZONE = 'Europe/Rome';

// Il foglio delle richieste: una riga per richiesta. L'ordine delle colonne è usato da rowToContact() e dagli aggiornamenti.
const SHEET_NAME = 'Richieste';
const SHEET_HEADERS = ['Riferimento', 'Ricevuta', 'Stato', 'Nome', 'Email', 'Si parte da', 'Materiale', 'Quantità', 'Entro quando', 'Oggetto', 'Lingua', 'Descrizione', 'File', 'Cartella Drive', 'Nota', 'Aggiornata'];
const COL = { reference: 0, receivedAt: 1, status: 2, driveUrl: 13, note: 14, updatedAt: 15 };
const CONTACT_STATUSES = ['received', 'reviewing', 'quoted', 'confirmed', 'printing', 'ready', 'closed'];
const REFERENCE = /^Q-[A-Z2-9]{5}$/;
const ADMIN_FAILS_PER_HOUR = 10;
const MAX_LIST = 500;
const LIBRARY_NAME = 'Libreria';
const MAX_FILES_LISTED = 200;

/* ---------- Punti d'ingresso ---------- */

function doPost(e) {
  try {
    const payload = parseBody(e);
    if (!payload) return reply({ ok: false, error: 'bad_request' });
    // Il modulo del sito non manda "action"; l'area riservata sì, e deve presentare la chiave.
    if (payload.action && payload.action !== 'submit') return adminAction(payload);

    const invalid = validate(payload);
    if (invalid) return reply({ ok: false, error: invalid });
    if (!allowRequest(payload.email)) return reply({ ok: false, error: 'rate_limited' });

    const reference = newReference();
    const folder = saveRequest(reference, payload);
    recordRequest(reference, payload, folder);
    notify(reference, payload, folder);
    return reply({ ok: true, reference });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return reply({ ok: false, error: 'server' });
  }
}

// Risponde a chi apre l'indirizzo nel browser: serve solo a controllare che la pubblicazione sia attiva.
function doGet() {
  return reply({ ok: true, service: 'modulo-contatti' });
}

/* ---------- Da lanciare a mano ---------- */

/** Crea la cartella radice su Drive e le impostazioni di base. Si può rilanciare senza danni. */
function inizializza() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    folderId = DriveApp.createFolder('Stampe3D – richieste').getId();
    props.setProperty('DRIVE_FOLDER_ID', folderId);
  }
  if (!props.getProperty('SHEET_ID')) {
    const spreadsheet = SpreadsheetApp.create('Stampe3D – elenco richieste');
    const sheet = spreadsheet.getSheets()[0];
    sheet.setName(SHEET_NAME);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setNumberFormat('@').setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
    DriveApp.getFileById(spreadsheet.getId()).moveTo(DriveApp.getFolderById(folderId));
    props.setProperty('SHEET_ID', spreadsheet.getId());
  }
  if (!props.getProperty('OWNER_EMAILS')) props.setProperty('OWNER_EMAILS', Session.getEffectiveUser().getEmail());
  if (!props.getProperty('SITE_NAME')) props.setProperty('SITE_NAME', 'Stampe3D');
  console.log('Cartella Drive delle richieste: ' + DriveApp.getFolderById(folderId).getUrl());
  console.log('Foglio delle richieste: ' + SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl());
  console.log('Le notifiche arrivano a: ' + props.getProperty('OWNER_EMAILS'));
}

/** Crea la chiave che apre l'elenco dei contatti nell'area riservata e la scrive nel registro: copiala subito. */
function creaChiaveAdmin() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  console.log('Chiave dei contatti (incollala nell\'area riservata): ' + key);
}

/** Invia una richiesta finta a te stesso: controlla cartella Drive ed email, e fa comparire le autorizzazioni. */
function prova() {
  const owner = Session.getEffectiveUser().getEmail();
  const risposta = doPost({
    postData: {
      contents: JSON.stringify({
        mode: 'idea',
        name: 'Prova collaudo',
        email: owner,
        description: 'Richiesta di collaudo lanciata dall’editor di Apps Script.',
        materialId: 'prova',
        materialLabel: 'PLA di prova',
        quantity: 1,
        privacyAccepted: true,
        lang: 'it',
        files: [],
      }),
    },
  });
  console.log(risposta.getContent());
}

/* ---------- Lettura e controllo ---------- */

function parseBody(e) {
  try {
    const parsed = JSON.parse(e.postData.contents);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

/** Toglie i caratteri di controllo (con `multiline` tiene gli a capo) e taglia alla lunghezza massima. */
function clean(value, max, multiline) {
  const pattern = multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return String(value === undefined || value === null ? '' : value).replace(pattern, ' ').trim().slice(0, max);
}

function base64Bytes(data) {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Ripete i controlli del sito: il browser non è mai una garanzia. Restituisce un codice d'errore o null. */
function validate(p) {
  if (!MODES.includes(p.mode)) return 'mode';
  if (clean(p.name, 120).length < 2) return 'name';
  const email = clean(p.email, 254);
  if (!EMAIL.test(email)) return 'email';
  if (clean(p.description, 5000, true).length < 10) return 'description';
  if (!clean(p.materialId, 60)) return 'material';
  if (clean(p.materialId, 60) === 'other' && clean(p.customMaterial, 120).length < 2) return 'customMaterial';
  const quantity = Math.floor(Number(p.quantity));
  if (!(quantity >= 1 && quantity <= 1000)) return 'quantity';
  if (p.privacyAccepted !== true) return 'privacy';

  const files = Array.isArray(p.files) ? p.files : [];
  if (p.mode === 'file' && files.length === 0) return 'files';
  return validateFiles(files);
}

/** Numero, formato e dimensione dei file: gli stessi limiti per il modulo e per il caricamento dall'area riservata. */
function validateFiles(files) {
  if (files.length > LIMITS.maxFiles) return 'files_count';
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || typeof file.name !== 'string' || typeof file.data !== 'string' || !file.data) return 'files';
    if (EXTENSIONS.indexOf(extensionOf(file.name)) < 0) return 'files_type';
    const size = base64Bytes(file.data);
    if (size > LIMITS.maxFileBytes) return 'files_size';
    total += size;
  }
  if (total > LIMITS.maxTotalBytes) return 'files_total';
  return null;
}

/** Al massimo `perEmailPerHour` richieste per indirizzo e `allPerHour` in tutto: argina i ripetitori e i bot. */
function allowRequest(email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const keys = ['all', 'mail:' + digest(email)];
    const limits = [LIMITS.allPerHour, LIMITS.perEmailPerHour];
    const counts = keys.map(function (key) { return Number(cache.get(key) || 0); });
    for (let i = 0; i < keys.length; i++) {
      if (counts[i] >= limits[i]) return false;
    }
    keys.forEach(function (key, i) { cache.put(key, String(counts[i] + 1), 3600); });
    return true;
  } finally {
    lock.releaseLock();
  }
}

function digest(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text).toLowerCase())
    .map(function (byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); })
    .join('')
    .slice(0, 32);
}

function newReference() {
  let code = '';
  for (let i = 0; i < 5; i++) code += REFERENCE_ALPHABET.charAt(Math.floor(Math.random() * REFERENCE_ALPHABET.length));
  return 'Q-' + code;
}

/* ---------- Drive ---------- */

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').slice(0, 120);
}

/** Una sottocartella per richiesta (data, riferimento, nome) con i file del cliente e un riepilogo. */
function saveRequest(reference, p) {
  const rootId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!rootId) throw new Error('DRIVE_FOLDER_ID mancante: lancia inizializza()');
  const root = DriveApp.getFolderById(rootId);
  const day = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const folder = root.createFolder(safeName(day + ' ' + reference + ' ' + clean(p.name, 60)));

  (Array.isArray(p.files) ? p.files : []).forEach(function (file) {
    const blob = Utilities.newBlob(Utilities.base64Decode(file.data), 'application/octet-stream', safeName(file.name));
    folder.createFile(blob);
  });
  folder.createFile('richiesta.txt', summary(reference, p), MimeType.PLAIN_TEXT);
  return folder;
}

/* ---------- Foglio delle richieste e area riservata ---------- */

function requestsSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME) : null;
}

/** Un testo che comincia con = + - @ potrebbe essere letto come formula: lo si fa precedere da uno spazio. */
function cell(value) {
  const text = String(value === undefined || value === null ? '' : value);
  return /^[=+\-@\t\r]/.test(text) ? ' ' + text : text;
}

/** Aggiunge la richiesta al foglio. Se il foglio non c'è o fallisce, la richiesta è comunque su Drive e per email. */
function recordRequest(reference, p, folder) {
  try {
    const sheet = requestsSheet();
    if (!sheet) return;
    const files = (Array.isArray(p.files) ? p.files : []).map(function (file) { return safeName(file.name); }).join('; ');
    const material = clean(p.materialId, 60) === 'other' ? 'Altro: ' + clean(p.customMaterial, 120) : clean(p.materialLabel, 120) || clean(p.materialId, 60);
    const row = [
      reference, new Date().toISOString(), 'received', clean(p.name, 120), clean(p.email, 254), p.mode === 'file' ? 'file' : 'idea',
      material, Math.floor(Number(p.quantity)), clean(p.deadline, 120), clean(p.workTitle, 120), p.lang === 'en' ? 'en' : 'it',
      clean(p.description, 5000, true), files, folder.getUrl(), '', '',
    ].map(cell);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // Formato "testo semplice": niente formule né date automatiche, qualunque cosa scriva il cliente.
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, SHEET_HEADERS.length);
      range.setNumberFormat('@');
      range.setValues([row]);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('Richiesta non scritta nel foglio: ' + (error && error.stack ? error.stack : error));
  }
}

function sameKey(given, stored) {
  const a = String(given === undefined || given === null ? '' : given);
  let diff = a.length === stored.length ? 0 : 1;
  for (let i = 0; i < stored.length; i++) diff |= (a.charCodeAt(i) || 0) ^ stored.charCodeAt(i);
  return diff === 0;
}

/** Controlla la chiave. Restituisce un codice d'errore oppure null se va bene. Dopo troppi errori blocca per un'ora. */
function checkAdminKey(given) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!stored) return 'not_configured';
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('adminfail') || 0);
  if (fails >= ADMIN_FAILS_PER_HOUR) return 'locked';
  if (sameKey(given, stored)) return null;
  cache.put('adminfail', String(fails + 1), 3600);
  return 'key';
}

function text(value) {
  return value instanceof Date ? value.toISOString() : String(value === undefined || value === null ? '' : value).trim();
}

function rowToContact(row) {
  return {
    reference: text(row[0]), receivedAt: text(row[1]), status: text(row[2]) || 'received', name: text(row[3]), email: text(row[4]),
    mode: text(row[5]), material: text(row[6]), quantity: Number(row[7]) || 1, deadline: text(row[8]), work: text(row[9]), lang: text(row[10]),
    description: text(row[11]), files: text(row[12]), driveUrl: text(row[13]), note: text(row[14]), updatedAt: text(row[15]),
  };
}

function adminAction(p) {
  const refused = checkAdminKey(p.key);
  if (refused) return reply({ ok: false, error: refused });
  if (p.action === 'files' || p.action === 'upload' || p.action === 'trash' || p.action === 'download') return driveAction(p);
  const sheet = requestsSheet();
  if (!sheet) return reply({ ok: false, error: 'not_configured' });
  const values = sheet.getDataRange().getValues();

  if (p.action === 'list') {
    const contacts = values.slice(1).filter(function (row) { return text(row[0]); }).map(rowToContact).reverse().slice(0, MAX_LIST);
    return reply({ ok: true, contacts: contacts });
  }

  const reference = text(p.reference);
  if (!REFERENCE.test(reference)) return reply({ ok: false, error: 'bad_request' });
  let index = -1;
  for (let i = 1; i < values.length; i++) {
    if (text(values[i][COL.reference]) === reference) { index = i; break; }
  }
  if (index < 0) return reply({ ok: false, error: 'not_found' });

  if (p.action === 'update') {
    if (CONTACT_STATUSES.indexOf(p.status) < 0) return reply({ ok: false, error: 'bad_request' });
    const note = cell(clean(p.note, 1000, true));
    sheet.getRange(index + 1, COL.status + 1, 1, 1).setNumberFormat('@').setValues([[p.status]]);
    sheet.getRange(index + 1, COL.note + 1, 1, 2).setNumberFormat('@').setValues([[note, new Date().toISOString()]]);
    return reply({ ok: true });
  }
  if (p.action === 'delete') {
    sheet.deleteRow(index + 1);
    return reply({ ok: true });
  }
  return reply({ ok: false, error: 'bad_request' });
}

/* ---------- File su Drive (area riservata) ---------- */

function rootFolder() {
  const id = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  return id ? DriveApp.getFolderById(id) : null;
}

/** La cartella "Libreria" dentro la radice: ci vanno i file caricati da noi che non riguardano una richiesta. La crea alla prima volta. */
function libraryFolder(root) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('LIBRARY_FOLDER_ID');
  if (stored) {
    try {
      const folder = DriveApp.getFolderById(stored);
      if (!folder.isTrashed()) return folder;
    } catch (error) { /* cancellata a mano: se ne crea una nuova */ }
  }
  const folder = root.createFolder(LIBRARY_NAME);
  props.setProperty('LIBRARY_FOLDER_ID', folder.getId());
  return folder;
}

/** Vero se `item` sta direttamente dentro `parentId`. */
function isChildOf(item, parentId) {
  const parents = item.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === parentId) return true;
  }
  return false;
}

/** Si può toccare solo ciò che sta nella Libreria o nella cartella di una richiesta: mai il foglio né altro in Drive. */
function isManagedFile(file, root) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (isChildOf(parents.next(), root.getId())) return true;
  }
  return false;
}

/** La cartella su cui agire: quella della richiesta `reference`, oppure la Libreria se non c'è. Restituisce { folder } o { error }. */
function targetFolder(p, root) {
  const reference = text(p.reference);
  if (!reference) return { folder: libraryFolder(root), library: true };
  if (!REFERENCE.test(reference)) return { error: 'bad_request' };
  const sheet = requestsSheet();
  if (!sheet) return { error: 'not_configured' };
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (text(values[i][COL.reference]) !== reference) continue;
    const match = /\/folders\/([A-Za-z0-9_-]+)/.exec(text(values[i][COL.driveUrl]));
    if (!match) return { error: 'not_found' };
    let folder;
    try { folder = DriveApp.getFolderById(match[1]); } catch (error) { return { error: 'not_found' }; }
    if (folder.isTrashed() || !isChildOf(folder, root.getId())) return { error: 'not_found' };
    return { folder: folder, library: false };
  }
  return { error: 'not_found' };
}

function describeFiles(folder) {
  const files = [];
  const iterator = folder.getFiles();
  let more = false;
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (files.length >= MAX_FILES_LISTED) { more = true; break; }
    files.push({ id: file.getId(), name: file.getName(), size: file.getSize(), updatedAt: file.getLastUpdated().toISOString(), url: file.getUrl() });
  }
  files.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
  return { files: files, truncated: more };
}

function driveAction(p) {
  const root = rootFolder();
  if (!root) return reply({ ok: false, error: 'not_configured' });

  if (p.action === 'download') {
    // Serve a scegliere un modello già su Drive quando si crea un oggetto: il contenuto va al browser dell'admin, che lo legge e lo riduce.
    const id = text(p.fileId);
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return reply({ ok: false, error: 'bad_request' });
    let file;
    try { file = DriveApp.getFileById(id); } catch (error) { return reply({ ok: false, error: 'not_found' }); }
    if (!isManagedFile(file, root)) return reply({ ok: false, error: 'not_found' });
    if (EXTENSIONS.indexOf(extensionOf(file.getName())) < 0) return reply({ ok: false, error: 'files_type' });
    if (file.getSize() > LIMITS.maxFileBytes) return reply({ ok: false, error: 'files_size' });
    return reply({ ok: true, name: file.getName(), data: Utilities.base64Encode(file.getBlob().getBytes()) });
  }

  if (p.action === 'trash') {
    const id = text(p.fileId);
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return reply({ ok: false, error: 'bad_request' });
    let file;
    try { file = DriveApp.getFileById(id); } catch (error) { return reply({ ok: false, error: 'not_found' }); }
    if (!isManagedFile(file, root)) return reply({ ok: false, error: 'not_found' });
    file.setTrashed(true); // nel cestino di Drive per 30 giorni: si può ripristinare da lì
    return reply({ ok: true });
  }

  const target = targetFolder(p, root);
  if (target.error) return reply({ ok: false, error: target.error });

  if (p.action === 'files') {
    const listing = describeFiles(target.folder);
    return reply({ ok: true, folder: { name: target.folder.getName(), url: target.folder.getUrl(), library: target.library }, files: listing.files, truncated: listing.truncated });
  }

  // upload
  const files = Array.isArray(p.files) ? p.files : [];
  if (files.length === 0) return reply({ ok: false, error: 'files' });
  const invalid = validateFiles(files);
  if (invalid) return reply({ ok: false, error: invalid });
  const saved = files.map(function (file) {
    const created = target.folder.createFile(Utilities.newBlob(Utilities.base64Decode(file.data), 'application/octet-stream', safeName(file.name)));
    return created.getName();
  });
  return reply({ ok: true, saved: saved });
}

/* ---------- Gmail ---------- */

function summary(reference, p) {
  const files = (Array.isArray(p.files) ? p.files : []).map(function (file) { return '  - ' + safeName(file.name); });
  const material = clean(p.materialId, 60) === 'other'
    ? 'Altro: ' + clean(p.customMaterial, 120)
    : clean(p.materialLabel, 120) || clean(p.materialId, 60);
  return [
    'Riferimento: ' + reference,
    'Data: ' + Utilities.formatDate(new Date(), TIME_ZONE, 'dd/MM/yyyy HH:mm'),
    'Nome: ' + clean(p.name, 120),
    'Email: ' + clean(p.email, 254),
    'Si parte da: ' + (p.mode === 'file' ? 'un file' : 'un’idea'),
    'Materiale: ' + material,
    'Quantità: ' + Math.floor(Number(p.quantity)),
    'Entro quando: ' + (clean(p.deadline, 120) || 'non indicato'),
    clean(p.workTitle, 120) ? 'Per la realizzazione: ' + clean(p.workTitle, 120) : null,
    'Lingua del cliente: ' + (p.lang === 'en' ? 'inglese' : 'italiano'),
    '',
    'Descrizione:',
    clean(p.description, 5000, true),
    '',
    files.length ? 'File:\n' + files.join('\n') : 'Nessun file allegato.',
  ].filter(function (line) { return line !== null; }).join('\n');
}

function notify(reference, p, folder) {
  const props = PropertiesService.getScriptProperties();
  const site = props.getProperty('SITE_NAME') || 'Stampe3D';
  const owners = (props.getProperty('OWNER_EMAILS') || Session.getEffectiveUser().getEmail())
    .split(',').map(function (address) { return address.trim(); }).filter(Boolean);
  const customer = clean(p.email, 254);
  const name = clean(p.name, 120);

  // A noi: se questa non parte la richiesta è comunque su Drive, ma il sito deve dire al cliente di riprovare.
  MailApp.sendEmail({
    to: owners.join(','),
    subject: '[' + site + '] Nuova richiesta ' + reference + ' – ' + clean(name, 60),
    body: summary(reference, p) + '\n\nCartella su Drive: ' + folder.getUrl() + '\n\nRispondi a questa email per scrivere al cliente.',
    replyTo: customer,
    name: site,
  });

  // Al cliente: se non parte (indirizzo sbagliato) non è un motivo per scartare la richiesta.
  try {
    const english = p.lang === 'en';
    MailApp.sendEmail({
      to: customer,
      subject: (english ? 'We received your request ' : 'Abbiamo ricevuto la tua richiesta ') + reference,
      body: english
        ? 'Hi ' + name + ',\n\nthanks for your request. We have received it and will reply by email.\n\nYour reference: ' + reference + '\n\nHere is what you sent us:\n\n' + summary(reference, p) + '\n\n— ' + site
        : 'Ciao ' + name + ',\n\ngrazie per la richiesta. L’abbiamo ricevuta e ti rispondiamo per email.\n\nIl tuo riferimento: ' + reference + '\n\nEcco cosa ci hai inviato:\n\n' + summary(reference, p) + '\n\n— ' + site,
      replyTo: owners[0],
      name: site,
    });
  } catch (error) {
    console.warn('Conferma al cliente non inviata: ' + error);
  }
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
