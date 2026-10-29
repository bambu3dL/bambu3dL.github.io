import { CONTACT_STATUSES, ValidationError, checkContactUpdate } from '../models/AdminRules.js';

// Le richieste di contatto, viste dall'area riservata. Il servizio non sa dove vivano: parla con il gateway che riceve.
const OPEN = new Set(['received', 'reviewing', 'quoted', 'confirmed', 'printing']);

export class ContactsAdmin {
  #gateway;

  constructor(gateway) {
    this.#gateway = gateway;
  }

  get configured() {
    return this.#gateway.configured;
  }

  /** Dalla più recente. */
  async list() {
    const contacts = await this.#gateway.list();
    return [...contacts].sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  }

  async update(reference, { status, note = '' }) {
    const errors = checkContactUpdate({ status, note });
    if (Object.keys(errors).length) throw new ValidationError(errors);
    await this.#gateway.update(reference, { status: String(status).trim(), note: String(note).trim() });
  }

  remove(reference) {
    return this.#gateway.remove(reference);
  }

  /** { received: 2, reviewing: 0, … , open: 3 } per i filtri e la panoramica. */
  static counts(contacts) {
    const counts = Object.fromEntries(CONTACT_STATUSES.map((status) => [status, 0]));
    contacts.forEach((contact) => { counts[contact.status] = (counts[contact.status] ?? 0) + 1; });
    counts.open = contacts.filter((contact) => OPEN.has(contact.status)).length;
    counts.all = contacts.length;
    return counts;
  }
}
