import { safeHex } from '../core/html.js';

// Un filo del catalogo (famiglia, colore) con le sue bobine fisiche. Dato di dominio puro, senza DOM e senza rete.
// Il residuo del filo è la somma di quello delle bobine in uso; le bobine finite non contano.
export class Material {
  constructor({ id, family, hex, ink, name, brand = '', spoolG, spools = [] }) {
    this.id = id;
    this.family = family;
    this.hex = safeHex(hex);
    this.ink = safeHex(ink, '#111111');
    this.names = name;
    this.brand = String(brand ?? '');
    this.spoolG = Math.max(1, Number(spoolG) || 1000); // peso nominale di una bobina nuova
    this.spools = spools.map((spool) => ({
      id: spool.id,
      netG: Math.max(1, Number(spool.netG) || this.spoolG),
      remainingG: Math.max(0, Number(spool.remainingG) || 0),
      active: spool.status !== 'finished',
    }));
  }

  get activeSpools() {
    return this.spools.filter((spool) => spool.active);
  }

  /** Grammi che restano in tutto, sulle bobine in uso. */
  get stockG() {
    return this.activeSpools.reduce((sum, spool) => sum + spool.remainingG, 0);
  }

  /** Grammi che le bobine in uso avevano da nuove; senza bobine, il peso di una nuova. */
  get capacityG() {
    const total = this.activeSpools.reduce((sum, spool) => sum + spool.netG, 0);
    return total > 0 ? total : this.spoolG;
  }

  /** Quota di filamento ancora disponibile rispetto alle bobine in uso, tra 0 e 1. */
  get remainingFraction() {
    return Math.min(1, this.stockG / this.capacityG);
  }

  name(lang) {
    return this.names[lang] || this.names.it;
  }

  label(lang) {
    return `${this.family} · ${this.name(lang)}`;
  }
}
