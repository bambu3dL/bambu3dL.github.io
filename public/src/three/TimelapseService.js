import { webglSupported } from './support.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BUILD_MS = 2600;
const HOLD_MS = 1100;
const FINAL_ANGLE = 0.7;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function nozzleOverlay() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'thumb-nozzle');
  svg.setAttribute('aria-hidden', 'true');
  const group = document.createElementNS(SVG_NS, 'g');
  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('class', 'nozzle-body');
  body.setAttribute('d', 'M-9 -26 H9 V-10 L3 0 H-3 L-9 -10 Z');
  const tip = document.createElementNS(SVG_NS, 'path');
  tip.setAttribute('class', 'nozzle-tip');
  tip.setAttribute('d', 'M-3 0 H3 L0 6 Z');
  group.append(body, tip);
  svg.append(group);
  return { svg, group };
}

// Anteprima "completa" nella vetrina; al passaggio del mouse l'oggetto si ricostruisce strato per strato, a time lapse.
// Un solo palco WebGL condiviso: la tela viene spostata sulla miniatura sotto il cursore.
export class TimelapseService {
  #stage = null;
  #PrintStage = null;
  #loading = null;
  #overlay = nozzleOverlay();
  #supported = webglSupported();
  #reduced;
  #current = null;
  #raf = 0;
  #host = null;
  #touchObserver = null;
  #seen = new WeakSet();

  constructor({ reducedMotion = false } = {}) {
    this.#reduced = reducedMotion;
  }

  /** Ascolta il mouse e la tastiera su tutto il documento: le viste devono solo marcare gli elementi. */
  attach() {
    if (!this.#supported || this.#reduced) return;
    document.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'touch') return;
      this.#enter(event.target.closest?.('[data-timelapse-host]'));
    });
    document.addEventListener('pointerout', (event) => {
      const host = event.target.closest?.('[data-timelapse-host]');
      if (host && !host.contains(event.relatedTarget)) this.#leave(host);
    });
    document.addEventListener('focusin', (event) => this.#enter(event.target.closest?.('[data-timelapse-host]')));
    document.addEventListener('focusout', (event) => {
      const host = event.target.closest?.('[data-timelapse-host]');
      if (host && !host.contains(event.relatedTarget)) this.#leave(host);
    });
  }

  /** Sui dispositivi senza mouse l'anteprima si ricostruisce una volta, quando entra in vista. */
  observe(root) {
    this.#touchObserver?.disconnect();
    if (!this.#supported || this.#reduced || !window.matchMedia('(hover: none)').matches) return;
    this.#touchObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const thumb = entry.target;
        if (!entry.isIntersecting || this.#seen.has(thumb) || this.#current) return;
        this.#seen.add(thumb);
        this.#start(thumb, { loop: false });
      });
    }, { threshold: 0.7 });
    root.querySelectorAll('[data-timelapse]').forEach((thumb) => this.#touchObserver.observe(thumb));
  }

  stop() {
    this.#touchObserver?.disconnect();
    this.#halt();
  }

  #enter(host) {
    if (!host || host === this.#host) return;
    this.#halt();
    this.#host = host;
    const thumb = host.querySelector('[data-timelapse]');
    if (thumb) this.#start(thumb, { loop: true });
  }

  #leave(host) {
    if (host !== this.#host) return;
    this.#host = null;
    this.#halt();
  }

  /** three.js si scarica alla prima anteprima animata, non all'apertura del sito. */
  async #ensureStage() {
    if (this.#PrintStage) return;
    this.#loading ??= import('./PrintStage.js').then((module) => { this.#PrintStage = module.PrintStage; });
    await this.#loading;
  }

  async #start(thumb, { loop }) {
    await this.#ensureStage();
    // Nel frattempo il mouse può essere uscito: in quel caso non c'è più niente da animare.
    if (loop && thumb.closest('[data-timelapse-host]') !== this.#host) return;
    if (this.#current) return;
    let shape;
    try {
      shape = JSON.parse(thumb.dataset.shape);
    } catch {
      return;
    }
    const live = thumb.querySelector('.thumb-live');
    const rect = thumb.getBoundingClientRect();
    if (!live || rect.width < 10) return;

    if (!this.#stage) {
      const canvas = document.createElement('canvas');
      canvas.className = 'thumb-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      this.#stage = new this.#PrintStage({ canvas, alpha: true });
    }
    const stage = this.#stage;
    stage.clearPrints();
    const print = stage.addPrint({ shape, hex: thumb.dataset.hex });
    stage.setSize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    stage.placePrint(print, { cx: rect.width / 2, cy: rect.height / 2, size: Math.min(rect.width, rect.height) * 0.74 });
    live.replaceChildren(stage.canvas, this.#overlay.svg);
    this.#overlay.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    thumb.classList.add('is-printing');

    const begin = performance.now();
    const scale = Math.max(0.5, Math.min(1.2, rect.width / 360));
    this.#current = { thumb, live };
    const tick = (now) => {
      const cycle = BUILD_MS + HOLD_MS;
      const elapsed = loop ? (now - begin) % cycle : Math.min(now - begin, cycle);
      const t = Math.min(1, elapsed / BUILD_MS);
      const printed = easeInOut(t);
      stage.setPrintState(print, { printed, angle: FINAL_ANGLE - (1 - printed) * 0.9 });
      stage.render();
      const top = stage.printTop(print);
      const building = printed < 0.995;
      this.#overlay.svg.style.opacity = building ? '1' : '0';
      this.#overlay.group.setAttribute('transform', `translate(${top.x.toFixed(1)} ${top.y.toFixed(1)}) scale(${scale.toFixed(2)})`);
      const done = !loop && now - begin >= cycle;
      if (done) {
        this.#halt();
        return;
      }
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  #halt() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    if (!this.#current) return;
    this.#current.thumb.classList.remove('is-printing');
    this.#current.live.replaceChildren();
    this.#current = null;
  }
}
