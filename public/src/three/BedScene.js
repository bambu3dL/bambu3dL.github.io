import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Plane,
  PointLight,
  RepeatWrapping,
  ACESFilmicToneMapping,
  Scene,
  Sprite,
  SpriteMaterial,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from '../../assets/vendor/three/three.module.min.js';
import { RoomEnvironment } from '../../assets/vendor/three/addons/RoomEnvironment.js';
import { buildPrintGeometry, outlineSampler, vaseRadius } from './PrintGeometry.js';
import { createPrintMaterial } from './PrintMaterial.js';

// La scena dell'hero: un ugello vero che stampa un vaso su un piatto in PEI con reticolo.
// Unità: 1 = 1 cm. Il piano sta a y = 0, centrato in x e z. Tutto l'aspetto viene da luci e materiali,
// non da texture dipinte, a parte la superficie del piatto (grana e reticolo).

const DEG = Math.PI / 180;
const PLATE = 25.6; // piatto 256 x 256 mm
// L'oggetto si ingrandisce finché la sua impronta occupa questa quota del lato del piatto (poi non supera l'altezza utile della macchina).
const FOOTPRINT_SHARE = 0.75;
const MAX_PRINT_HEIGHT = 25.6;
// L'altezza di riferimento con cui sono tarati camera e luci: con oggetti più alti o più bassi si scalano insieme.
const REFERENCE_HEIGHT = 16;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** Piano in PEI: grana fine e reticolo inciso ogni centimetro, con segni più forti ogni cinque. */
function plateTextures(maxAnisotropy) {
  const size = 2048;
  const mmToPx = size / (PLATE * 10);

  const noise = document.createElement('canvas');
  noise.width = noise.height = 1024;
  const nctx = noise.getContext('2d');
  const data = nctx.createImageData(1024, 1024);
  for (let i = 0; i < data.data.length; i += 4) {
    const grain = 128 + (Math.random() - 0.5) * 70;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = grain;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);

  const color = document.createElement('canvas');
  color.width = color.height = size;
  const c = color.getContext('2d');
  c.fillStyle = '#3a3025';
  c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = 0.9;
  c.drawImage(noise, 0, 0, size, size);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;

  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const b = bump.getContext('2d');
  b.drawImage(noise, 0, 0, size, size);

  const drawGrid = (ctx, minor, major, minorWidth, majorWidth) => {
    const step = 10 * mmToPx;
    for (let i = 0; i <= 25; i += 1) {
      const position = (size - 25 * step) / 2 + i * step;
      const strong = i % 5 === 0;
      ctx.strokeStyle = strong ? major : minor;
      ctx.lineWidth = strong ? majorWidth : minorWidth;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, size);
      ctx.moveTo(0, position);
      ctx.lineTo(size, position);
      ctx.stroke();
    }
  };
  drawGrid(c, 'rgba(226,196,138,0.26)', 'rgba(226,196,138,0.5)', 2, 3.5);
  drawGrid(b, 'rgba(20,20,20,0.9)', 'rgba(0,0,0,1)', 3, 5);

  const border = 6 * mmToPx;
  c.strokeStyle = 'rgba(226,196,138,0.55)';
  c.lineWidth = 3;
  c.strokeRect(border, border, size - 2 * border, size - 2 * border);

  const make = (canvas, srgb) => {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = maxAnisotropy;
    if (srgb) texture.colorSpace = SRGBColorSpace;
    return texture;
  };
  return { map: make(color, true), bump: make(bump, false) };
}

/** Alone caldo sulla punta: un disco sfumato additivo, niente di più. */
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,190,110,1)');
  gradient.addColorStop(0.25, 'rgba(255,120,40,0.55)');
  gradient.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function metal(color, roughness, metalness = 1) {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

export class BedScene {
  #renderer;
  #scene = new Scene();
  #camera = new PerspectiveCamera(30, 1, 0.1, 500);
  #world = new Group();
  #vase;
  #printScale = 1; // da unità normalizzate della geometria a centimetri nella scena
  #printHeight = REFERENCE_HEIGHT;
  #plane = new Plane();
  #toolhead = new Group();
  #glow;
  #tipLight;
  #shape;
  #outline = null;
  #geometry;
  #width = 1;
  #height = 1;
  #aspect = 1;
  #lookAt = new Vector3();
  #floor;

  constructor(canvas, { filamentHex, shape }) {
    this.#shape = shape;
    this.#renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 0.95;
    this.#renderer.localClippingEnabled = true;
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = PCFSoftShadowMap;
    this.#renderer.setClearColor(0x000000, 0);

    const pmrem = new PMREMGenerator(this.#renderer);
    this.#scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.#scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.#scene.fog = new Fog(0x111111, 38, 130);
    this.#scene.add(this.#world);

    this.#buildLights();
    this.#buildBed();
    this.#buildVase(filamentHex);
    this.#buildToolhead(filamentHex);
  }

  #buildLights() {
    this.#scene.add(new HemisphereLight(0xdfe6f2, 0x2a2118, 0.28));
    const key = new DirectionalLight(0xfff0dc, 2.8);
    key.position.set(-18, 34, 22);
    key.target.position.set(0, 6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -22;
    key.shadow.camera.right = 22;
    key.shadow.camera.top = 26;
    key.shadow.camera.bottom = -22;
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 100;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 4;
    this.#scene.add(key, key.target);
    const rim = new DirectionalLight(0xbdd2ff, 1.4);
    rim.position.set(24, 10, -28);
    this.#scene.add(rim);

    // Il calore dell'ugello illumina davvero l'ultimo strato.
    this.#tipLight = new PointLight(0xff8a3c, 0, 9, 2);
    this.#world.add(this.#tipLight);
  }

  #buildBed() {
    const anisotropy = this.#renderer.capabilities.getMaxAnisotropy();
    const { map, bump } = plateTextures(anisotropy);
    const top = new MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.6,
      roughness: 0.58,
      metalness: 0.5,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    });
    const steel = metal(0x8d9097, 0.4, 0.95);
    const plate = new Mesh(new BoxGeometry(PLATE, 0.14, PLATE), [steel, steel, top, steel, steel, steel]);
    plate.position.y = -0.07;
    plate.receiveShadow = true;
    this.#world.add(plate);

    const tab = new Mesh(new BoxGeometry(5.5, 0.14, 2.4), steel);
    tab.position.set(0, -0.07, PLATE / 2 + 1.2);
    tab.receiveShadow = true;
    this.#world.add(tab);

    const frame = new Mesh(new BoxGeometry(PLATE + 1.4, 1.1, PLATE + 1.4), metal(0x2c2e33, 0.5, 0.85));
    frame.position.y = -0.14 - 0.55;
    frame.receiveShadow = true;
    this.#world.add(frame);

    // Il pavimento prende il colore dello sfondo (così non c'è un orizzonte); l'ombra della macchina sta su un piano a parte.
    this.#floor = new Mesh(new PlaneGeometry(600, 600), new MeshBasicMaterial({ color: 0x111111 }));
    this.#floor.rotation.x = -Math.PI / 2;
    this.#floor.position.y = -1.95;
    this.#world.add(this.#floor);
    const shade = new Mesh(new PlaneGeometry(600, 600), new ShadowMaterial({ opacity: 0.35 }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = -1.9;
    shade.receiveShadow = true;
    this.#world.add(shade);
  }

  #buildVase(hex) {
    this.#geometry = buildPrintGeometry(this.#shape);
    // Il vaso ha una formula; ogni altra forma (ingranaggio, modello vero) si segue dal suo contorno.
    this.#outline = this.#shape.kind === 'twistVase' ? null : outlineSampler(this.#geometry);
    const { minY, spanY, solid } = this.#geometry.userData;
    const material = createPrintMaterial({ hex, minY, spanY, solid, layers: 200, hotWidth: 0.22 });
    material.clippingPlanes = [this.#plane];
    material.roughness = 0.4;
    this.#vase = new Mesh(this.#geometry, material);
    // Impronta a terra (il lato maggiore tra larghezza e profondità) = 75% del piatto; il resto cresce in proporzione.
    const { boundingBox } = this.#geometry;
    const footprint = Math.max(boundingBox.max.x - boundingBox.min.x, boundingBox.max.z - boundingBox.min.z, 1e-6);
    this.#printScale = Math.min((PLATE * FOOTPRINT_SHARE) / footprint, MAX_PRINT_HEIGHT / spanY);
    this.#printHeight = spanY * this.#printScale;
    this.#vase.scale.setScalar(this.#printScale);
    this.#vase.position.y = -minY * this.#printScale;
    this.#vase.castShadow = true;
    this.#vase.receiveShadow = true;
    this.#world.add(this.#vase);
  }

  /** Ugello, blocco riscaldatore, dissipatore e la cappa della ventola, con il filamento che sale. */
  #buildToolhead(hex) {
    const brass = metal(0xc79a46, 0.28);
    const aluminium = metal(0xc4c8cf, 0.35);
    const steel = metal(0x8f949c, 0.3);
    const black = new MeshStandardMaterial({ color: 0x17181b, roughness: 0.7, metalness: 0.2 });
    const accent = new MeshStandardMaterial({ color: 0xff6a1f, roughness: 0.5, metalness: 0.1 });
    const group = this.#toolhead;
    const add = (mesh, y, x = 0, z = 0) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    add(new Mesh(new CylinderGeometry(0.26, 0.05, 0.55, 32), brass), 0.275);
    add(new Mesh(new CylinderGeometry(0.34, 0.34, 0.42, 6), brass), 0.76);
    add(new Mesh(new BoxGeometry(1.5, 0.9, 1.9), aluminium), 1.42);
    add(new Mesh(new BoxGeometry(1.62, 0.55, 2.02), black), 1.62);
    add(new Mesh(new CylinderGeometry(0.27, 0.27, 1.2, 24), steel), 2.5);
    for (let i = 0; i < 6; i += 1) add(new Mesh(new BoxGeometry(1.9, 0.07, 1.9), aluminium), 3.2 + i * 0.2);
    add(new Mesh(new BoxGeometry(3.6, 2.4, 3.4), black), 5.5);
    add(new Mesh(new BoxGeometry(3.7, 0.18, 1.2), accent), 6.8, 0, 1.0);
    add(new Mesh(new CylinderGeometry(1.1, 1.1, 0.5, 40), black), 5.2, 0, 2.0).rotation.x = Math.PI / 2;

    const tube = new Mesh(
      new CylinderGeometry(0.26, 0.26, 70, 16),
      new MeshStandardMaterial({ color: 0xf0f0f2, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    tube.position.y = 7 + 35;
    group.add(tube);
    const filament = new Mesh(
      new CylinderGeometry(0.1, 0.1, 70, 12),
      new MeshStandardMaterial({ color: hex, roughness: 0.5 }),
    );
    filament.position.y = 7 + 35;
    group.add(filament);

    this.#glow = new Sprite(new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    this.#glow.scale.setScalar(2.4);
    this.#glow.position.y = 0.1;
    group.add(this.#glow);
    this.#world.add(group);
  }

  setFog(hex) {
    this.#scene.fog.color.set(hex);
    this.#floor.material.color.set(hex);
  }

  setSize(width, height, pixelRatio) {
    this.#width = Math.max(1, width);
    this.#height = Math.max(1, height);
    this.#aspect = this.#width / this.#height;
    this.#renderer.setPixelRatio(pixelRatio);
    this.#renderer.setSize(this.#width, this.#height, false);
    this.#camera.aspect = this.#aspect;
    this.#camera.updateProjectionMatrix();
  }

  /**
   * @param {number} t quanta parte del vaso è stampata (0..1)
   * @param {number} q quanto la camera si è allontanata alla fine (0..1)
   */
  render(t, q) {
    const y = this.#printHeight * t;
    // Camera e luci sono tarate su un oggetto alto 16 cm: un oggetto più alto o più basso sposta tutto in proporzione.
    const k = Math.max(0.6, this.#printHeight / REFERENCE_HEIGHT);

    // L'ugello gira lungo la parete del vaso: la modalità vaso è una sola spirale continua.
    const angle = t * Math.PI * 2 * 150;
    const { center, extent } = this.#geometry.userData;
    // Con il contorno il raggio è già nelle unità normalizzate e centrato sull'asse; con la formula del vaso no.
    const raw = this.#outline ? this.#outline(t, angle) : vaseRadius(this.#shape, t, angle);
    const [originX, originZ, divisor] = this.#outline ? [0, 0, 1] : [center[0], center[2], extent];
    const scale = this.#printScale;
    const tipX = ((Math.cos(angle) * raw - originX) / divisor) * scale;
    const tipZ = ((Math.sin(angle) * raw - originZ) / divisor) * scale;
    const tip = new Vector3(tipX, y + 0.12, tipZ);
    const parked = new Vector3(13 * k, this.#printHeight + 9, -3);
    tip.lerp(parked, smooth(q));
    this.#toolhead.position.copy(tip);
    this.#tipLight.position.set(tip.x, tip.y + 0.5, tip.z);
    this.#tipLight.intensity = 26 * (1 - smooth(q));
    this.#glow.material.opacity = 0.85 * (1 - smooth(q));

    this.#plane.set(new Vector3(0, -1, 0), t >= 0.999 ? 1e6 : y);

    // Camera: parte bassa e vicina, sale con l'ugello, poi si allontana per mostrare l'oggetto intero.
    const pull = smooth(q);
    const azimuth = lerp(16, 46, t) + pull * 12;
    const elevation = lerp(8, 15, t) + pull * 9;
    const aspectFit = (2 * Math.max(0.5, raw) * scale * 1.35) / (Math.min(1, this.#aspect) * 2 * Math.tan(15 * DEG));
    const distance = Math.max(lerp(14.5, 25, t) * k, aspectFit) + pull * 18 * k;
    const lookY = lerp(lerp(2.2, y * 0.82 + 1.2, clamp01(t * 1.2)), this.#printHeight * 0.55, pull);
    this.#lookAt.set(0, lookY, 0);
    const a = azimuth * DEG;
    const e = elevation * DEG;
    this.#camera.position.set(
      Math.sin(a) * Math.cos(e) * distance,
      lookY + Math.sin(e) * distance,
      Math.cos(a) * Math.cos(e) * distance,
    );
    this.#camera.lookAt(this.#lookAt);
    // La nebbia parte oltre il soggetto, a qualsiasi distanza stia la camera (su telefono è più lontana).
    this.#scene.fog.near = distance + 26;
    this.#scene.fog.far = distance + 120;

    // La stampa sta a destra e lascia il titolo a sinistra; alla fine torna al centro.
    const wide = this.#aspect >= 0.9;
    const shift = 1 - pull;
    this.#camera.setViewOffset(
      this.#width,
      this.#height,
      wide ? -this.#width * 0.13 * shift : 0,
      wide ? 0 : -this.#height * 0.16 * shift,
      this.#width,
      this.#height,
    );
    this.#camera.updateMatrixWorld(true);
    this.#renderer.render(this.#scene, this.#camera);
  }

  dispose() {
    this.#scene.environment?.dispose();
    this.#renderer.dispose();
    this.#renderer.forceContextLoss();
  }
}
