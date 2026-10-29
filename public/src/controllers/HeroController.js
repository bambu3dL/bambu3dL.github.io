import { webglSupported } from '../three/support.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => t * t * (3 - 2 * t);
const LAYER_MM = 0.2;
const INTRO_MS = 1700;

// L'hero è un unico piano sequenza: lo scroll fa avanzare la stampa dell'oggetto.
// Qui c'è il DOM (progresso, contatore, testi che compaiono e spariscono); la scena 3D sta in BedScene.
export class HeroController {
  #root;
  #work;
  #material;
  #i18n;
  #reduced;
  #scene = null;
  #pin;
  #canvas;
  #copy;
  #finale;
  #hud;
  #hint;
  #bar;
  #layer;
  #grams;
  #layersTotal;
  #target = 0;
  #shown = 0;
  #intro = 0;
  #introStart = 0;
  #raf = 0;
  #last = 0;
  #active = true;
  #listeners = [];
  #resizeObserver;
  #themeObserver;
  #disposed = false;

  constructor({ root, work, material, i18n, reducedMotion }) {
    this.#root = root;
    this.#work = work;
    this.#material = material;
    this.#i18n = i18n;
    this.#reduced = reducedMotion;
    this.#pin = root.querySelector('.hero-pin');
    this.#canvas = root.querySelector('[data-hero-canvas]');
    this.#copy = root.querySelector('[data-hero-copy]');
    this.#finale = root.querySelector('[data-hero-finale]');
    this.#hud = root.querySelector('[data-hero-hud]');
    this.#hint = root.querySelector('.hero-hint');
    this.#bar = root.querySelector('[data-hud-bar]');
    this.#layer = root.querySelector('[data-hud-layer]');
    this.#grams = root.querySelector('[data-hud-grams]');
    this.#layersTotal = Math.round((work.dimensionsMm[2] || 200) / LAYER_MM);
  }

  async start() {
    if (!webglSupported()) {
      this.#root.classList.add('is-flat');
      return;
    }
    try {
      const [{ BedScene }, { preloadShapes }] = await Promise.all([import('../three/BedScene.js'), import('../three/PrintGeometry.js')]);
      await preloadShapes([this.#work.shape]);
      if (this.#disposed) return;
      this.#scene = new BedScene(this.#canvas, { filamentHex: this.#material.hex, shape: this.#work.shape });
    } catch {
      this.#root.classList.add('is-flat');
      return;
    }
    this.#applyFog();
    this.#themeObserver = new MutationObserver(() => {
      this.#applyFog();
      this.#schedule();
    });
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    this.#resizeObserver = new ResizeObserver(() => this.#layout());
    this.#resizeObserver.observe(this.#pin);
    this.#listen(window, 'scroll', () => this.#onScroll(), { passive: true });

    const visibility = new IntersectionObserver(([entry]) => {
      this.#active = entry.isIntersecting;
      if (this.#active) this.#schedule();
    }, { rootMargin: '120px' });
    visibility.observe(this.#pin);
    this.#listeners.push({ dispose: () => visibility.disconnect() });

    this.#target = this.#reduced ? 0.72 : this.#progress();
    this.#shown = this.#target;
    this.#introStart = performance.now() + 250;
    this.#intro = this.#reduced ? 1 : 0;
    this.#layout();
    this.#schedule();
  }

  #listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#listeners.push({ dispose: () => target.removeEventListener(type, handler, options) });
  }

  #applyFog() {
    const fog = getComputedStyle(this.#pin).getPropertyValue('--stage-fog').trim() || '#111';
    this.#scene?.setFog(fog);
  }

  #layout() {
    const box = this.#pin.getBoundingClientRect();
    this.#scene.setSize(box.width, box.height, Math.min(window.devicePixelRatio || 1, box.width < 700 ? 1.6 : 2));
    this.#draw();
  }

  #progress() {
    const rect = this.#root.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    return travel > 0 ? clamp01(-rect.top / travel) : 0;
  }

  #onScroll() {
    if (!this.#reduced) this.#target = this.#progress();
    this.#schedule();
  }

  #schedule() {
    if (this.#raf || !this.#active) return;
    this.#last = 0;
    this.#raf = requestAnimationFrame((time) => this.#frame(time));
  }

  /** L'avanzamento mostrato insegue quello dello scroll con un filo di inerzia: la macchina non scatta. */
  #frame(time) {
    const dt = this.#last ? Math.min(0.05, (time - this.#last) / 1000) : 1 / 60;
    this.#last = time;
    this.#shown += (this.#target - this.#shown) * (1 - Math.exp(-dt * 7));
    const settledScroll = Math.abs(this.#target - this.#shown) < 0.0002;
    if (settledScroll) this.#shown = this.#target;

    let introRunning = false;
    if (this.#intro < 1) {
      const raw = clamp01((performance.now() - this.#introStart) / INTRO_MS);
      this.#intro = 1 - (1 - raw) ** 3;
      introRunning = raw < 1;
    }
    this.#draw();
    this.#raf = 0;
    if (!settledScroll || introRunning) this.#raf = requestAnimationFrame((next) => this.#frame(next));
  }

  #draw() {
    if (!this.#scene) return;
    const p = this.#shown;
    // La stampa avanza per quasi tutto lo scroll; nell'ultimo tratto la camera si allontana.
    const run = clamp01((p - 0.02) / 0.8);
    const t = 0.16 * this.#intro + 0.84 * run;
    const q = clamp01((p - 0.84) / 0.16);
    this.#scene.render(t, q);

    const copy = this.#reduced ? 1 : 1 - smooth(clamp01((p - 0.06) / 0.16));
    this.#copy.style.opacity = copy.toFixed(3);
    this.#copy.style.translate = `0 ${((1 - copy) * -20).toFixed(1)}px`;
    this.#copy.style.pointerEvents = copy < 0.4 ? 'none' : '';
    // Il finale arriva a piena opacità prima che la sezione si sganci: alla fine dello scroll è già fermo.
    const finale = this.#reduced ? 0 : smooth(clamp01((p - 0.78) / 0.15));
    this.#finale.style.opacity = finale.toFixed(3);
    this.#finale.style.translate = `0 ${((1 - finale) * 18).toFixed(1)}px`;
    this.#finale.style.pointerEvents = finale < 0.5 ? 'none' : '';
    // L'invito allo scroll serve solo all'inizio.
    if (this.#hint) this.#hint.style.opacity = this.#reduced ? '1' : (1 - smooth(clamp01(p / 0.08))).toFixed(3);

    this.#layer.textContent = new Intl.NumberFormat(this.#i18n.lang).format(Math.round(t * this.#layersTotal));
    this.#grams.textContent = this.#i18n.grams(t * this.#work.estimatedG);
    this.#bar.style.setProperty('--fill', `${(t * 100).toFixed(1)}%`);
  }

  dispose() {
    this.#disposed = true;
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver?.disconnect();
    this.#themeObserver?.disconnect();
    this.#listeners.forEach((listener) => listener.dispose());
    this.#scene?.dispose();
  }
}
