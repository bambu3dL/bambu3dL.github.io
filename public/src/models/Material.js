import { safeHex } from '../core/html.js';

// Una bobina a magazzino: dato di dominio puro, senza DOM e senza rete.
export class Material {
  constructor({ id, family, hex, ink, name, stockG, spoolG }) {
    this.id = id;
    this.family = family;
    this.hex = safeHex(hex);
    this.ink = safeHex(ink, '#111111');
    this.names = name;
    this.stockG = Math.max(0, Number(stockG) || 0);
    this.spoolG = Math.max(1, Number(spoolG) || 1000);
  }

  /** Quota di bobina ancora piena, tra 0 e 1. */
  get remainingFraction() {
    return Math.min(1, this.stockG / this.spoolG);
  }

  name(lang) {
    return this.names[lang] || this.names.it;
  }

  label(lang) {
    return `${this.family} · ${this.name(lang)}`;
  }
}
