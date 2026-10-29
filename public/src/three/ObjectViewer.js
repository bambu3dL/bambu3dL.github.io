import { PrintStage } from './PrintStage.js';

const DRAG_SPEED = 0.008;
const KEY_STEP = 0.18;
const AUTO_SPEED = 0.35; // radianti al secondo

// Visualizzatore di una singola stampa: gira da sola, si trascina col dito/mouse e si ruota con le frecce.
export class ObjectViewer {
  #container;
  #stage;
  #print;
  #angle = 0.6;
  #auto;
  #raf = 0;
  #last = 0;
  #visible = true;
  #dragging = null;
  #observers = [];

  constructor(container, { work, material, reducedMotion = false }) {
    this.#container = container;
    this.#auto = !reducedMotion;
    const canvas = document.createElement('canvas');
    canvas.className = 'viewer-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.append(canvas);
    this.#stage = new PrintStage({ canvas });
    this.#print = this.#stage.addPrint({ shape: work.shape, hex: material.hex });

    const resize = new ResizeObserver(() => this.#layout());
    resize.observe(container);
    const visibility = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting;
      if (this.#visible) this.#schedule();
    });
    visibility.observe(container);
    this.#observers.push(resize, visibility);

    container.addEventListener('pointerdown', this.#onDown);
    container.addEventListener('pointermove', this.#onMove);
    container.addEventListener('pointerup', this.#onUp);
    container.addEventListener('pointercancel', this.#onUp);
    container.addEventListener('keydown', this.#onKey);
    this.#layout();
  }

  #layout() {
    const { clientWidth: w, clientHeight: h } = this.#container;
    if (!w || !h) return;
    this.#stage.setSize(w, h, Math.min(window.devicePixelRatio || 1, 2));
    this.#stage.placePrint(this.#print, { cx: w / 2, cy: h / 2, size: Math.min(w, h) * 0.78 });
    this.#draw();
  }

  #draw() {
    this.#stage.setPrintState(this.#print, { printed: 1, angle: this.#angle });
    this.#stage.render();
  }

  #schedule() {
    if (this.#raf || !this.#auto || !this.#visible) return;
    this.#raf = requestAnimationFrame((time) => {
      this.#raf = 0;
      const dt = this.#last ? Math.min(0.05, (time - this.#last) / 1000) : 0;
      this.#last = time;
      if (!this.#dragging) this.#angle += dt * AUTO_SPEED;
      this.#draw();
      this.#schedule();
    });
  }

  start() {
    this.#schedule();
  }

  #onDown = (event) => {
    this.#dragging = { x: event.clientX };
    this.#container.setPointerCapture?.(event.pointerId);
  };

  #onMove = (event) => {
    if (!this.#dragging) return;
    this.#angle += (event.clientX - this.#dragging.x) * DRAG_SPEED;
    this.#dragging.x = event.clientX;
    this.#draw();
  };

  #onUp = () => {
    this.#dragging = null;
  };

  #onKey = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    this.#angle += event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP;
    this.#draw();
  };

  dispose() {
    cancelAnimationFrame(this.#raf);
    this.#observers.forEach((observer) => observer.disconnect());
    this.#stage.dispose();
    this.#container.replaceChildren();
  }
}
