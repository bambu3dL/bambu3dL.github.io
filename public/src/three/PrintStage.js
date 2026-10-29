import {
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  OrthographicCamera,
  PMREMGenerator,
  Plane,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from '../../assets/vendor/three/three.module.min.js';
import { RoomEnvironment } from '../../assets/vendor/three/addons/RoomEnvironment.js';
import { buildPrintGeometry } from './PrintGeometry.js';
import { createPrintMaterial } from './PrintMaterial.js';

const TILT = 0.52;
const UP = new Vector3(0, -1, 0);

// Palco condiviso da hero, scheda oggetto e miniature: un renderer, una camera ortografica in pixel,
// luci e ambiente. Le "stampe" sono gruppi inclinati che ruotano su sé stessi.
export class PrintStage {
  #renderer;
  #scene = new Scene();
  #camera = new OrthographicCamera(0, 1, 1, 0, -2000, 2000);
  #prints = [];
  #width = 1;
  #height = 1;

  constructor({ canvas, alpha = true, antialias = true }) {
    this.#renderer = new WebGLRenderer({ canvas, alpha, antialias, powerPreference: 'default' });
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = NeutralToneMapping;
    this.#renderer.toneMappingExposure = 1;
    this.#renderer.localClippingEnabled = true;
    this.#renderer.setClearColor(0x000000, 0);
    this.#camera.position.z = 1000;

    const pmrem = new PMREMGenerator(this.#renderer);
    this.#scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.#scene.environmentIntensity = 0.85;
    pmrem.dispose();

    this.#scene.add(new HemisphereLight(0xffffff, 0x3a342b, 0.45));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(-420, 640, 520);
    this.#scene.add(key);
    const rim = new DirectionalLight(0xbcd2ff, 0.9);
    rim.position.set(520, 200, -380);
    this.#scene.add(rim);
  }

  get canvas() {
    return this.#renderer.domElement;
  }

  /** Aggiunge una stampa. `printed` e `angle` si aggiornano poi con setPrintState. */
  addPrint({ shape, hex, layers }) {
    const geometry = buildPrintGeometry(shape);
    const { minY, spanY, solid } = geometry.userData;
    const material = createPrintMaterial({ hex, minY, spanY, solid, ...(layers ? { layers } : {}) });
    const plane = new Plane();
    material.clippingPlanes = [plane];

    const pivot = new Group();
    const tilt = new Group();
    tilt.rotation.x = TILT;
    const spin = new Group();
    const mesh = new Mesh(geometry, material);
    spin.add(mesh);
    tilt.add(spin);
    pivot.add(tilt);
    this.#scene.add(pivot);

    const print = { pivot, tilt, spin, mesh, material, plane, minY, spanY, size: 100, printed: 1, visible: true };
    this.#prints.push(print);
    return print;
  }

  clearPrints() {
    this.#prints.forEach((print) => {
      this.#scene.remove(print.pivot);
      print.material.dispose();
    });
    this.#prints = [];
  }

  /** Posiziona una stampa: centro in pixel CSS dal bordo alto-sinistro e altezza di riferimento. */
  placePrint(print, { cx, cy, size }) {
    print.size = size;
    print.pivot.position.set(cx, this.#height - cy, 0);
    print.mesh.scale.setScalar(size);
  }

  /** `lean` inclina la stampa verso il puntatore: x gira attorno all'asse di vista, y la china avanti o indietro. */
  setPrintState(print, { printed, angle, visible = true, lean = null }) {
    print.printed = printed;
    print.visible = visible;
    print.pivot.visible = visible;
    print.spin.rotation.y = angle;
    print.tilt.rotation.x = TILT + (lean ? lean.y : 0);
    print.tilt.rotation.z = lean ? lean.x : 0;
  }

  /** Punto in pixel CSS (dall'alto a sinistra) dove la stampa sta crescendo: il centro dello strato in costruzione. */
  printTop(print) {
    print.pivot.updateMatrixWorld(true);
    const localY = (print.minY + print.spanY * Math.min(1, Math.max(0, print.printed))) * print.size;
    const point = new Vector3(0, localY, 0).applyMatrix4(print.tilt.matrixWorld);
    return { x: point.x, y: this.#height - point.y };
  }

  setSize(width, height, pixelRatio) {
    this.#width = Math.max(1, width);
    this.#height = Math.max(1, height);
    this.#renderer.setPixelRatio(pixelRatio);
    this.#renderer.setSize(this.#width, this.#height, false);
    this.#camera.left = 0;
    this.#camera.right = this.#width;
    this.#camera.top = this.#height;
    this.#camera.bottom = 0;
    this.#camera.updateProjectionMatrix();
  }

  render() {
    this.#prints.forEach((print) => {
      if (!print.visible) return;
      // Il piano resta sempre assegnato (cambiare il numero di piani ricompilerebbe lo shader):
      // a stampa finita lo spostiamo lontano, così non taglia più nulla.
      if (print.printed >= 0.999) {
        print.plane.set(UP, 1e6);
        return;
      }
      print.pivot.updateMatrixWorld(true);
      const localY = (print.minY + print.spanY * Math.max(0, print.printed)) * print.size;
      const normal = UP.clone().transformDirection(print.tilt.matrixWorld);
      const point = new Vector3(0, localY, 0).applyMatrix4(print.tilt.matrixWorld);
      print.plane.setFromNormalAndCoplanarPoint(normal, point);
    });
    this.#renderer.render(this.#scene, this.#camera);
  }

  dispose() {
    this.clearPrints();
    this.#scene.environment?.dispose();
    this.#renderer.dispose();
    // Liberiamo il contesto WebGL subito: il browser ne concede un numero limitato.
    this.#renderer.forceContextLoss();
  }
}
