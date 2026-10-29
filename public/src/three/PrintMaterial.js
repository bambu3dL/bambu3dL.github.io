import { Color, MeshStandardMaterial } from '../../assets/vendor/three/three.module.min.js';

/** Il colore di un filamento stampato è meno saturo di quello della bobina: un tocco verso il grigio. */
function filamentColor(hex) {
  const color = new Color(hex);
  const hsl = {};
  color.getHSL(hsl);
  return color.setHSL(hsl.h, hsl.s * 0.8, hsl.l);
}

// Il materiale di una stampa FDM: linee di strato che catturano la luce, e, sul lato interno del taglio,
// una griglia che ricorda il riempimento. Il tutto agganciato a MeshStandardMaterial con poche righe di shader.

const LAYERS_ACROSS_OBJECT = 84;

export function createPrintMaterial({ hex, minY, spanY, solid, layers = LAYERS_ACROSS_OBJECT, hotWidth = 7 }) {
  const material = new MeshStandardMaterial({
    color: filamentColor(hex),
    roughness: 0.54,
    envMapIntensity: 0.75,
    metalness: 0,
    side: 2, // DoubleSide: serve per vedere l'interno mentre la stampa cresce
  });
  material.clipShadows = true; // l'ombra della stampa deve fermarsi dove si ferma il taglio

  const uniforms = {
    uLayers: { value: layers },
    uMinY: { value: minY },
    uSpanY: { value: spanY },
    uInfill: { value: solid ? 1 : 0 },
    uHot: { value: 1 },
    uHotWidth: { value: hotWidth },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocal;
         uniform float uLayers;
         uniform float uMinY;
         uniform float uSpanY;
         uniform float uInfill;
         uniform float uHot;
         uniform float uHotWidth;
         float layerBand() {
           float ly = (vLocal.y - uMinY) / uSpanY * uLayers;
           return abs(fract(ly) - 0.5) * 2.0;
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float band = layerBand();
         diffuseColor.rgb *= 0.9 + 0.1 * (1.0 - band * band);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(roughnessFactor + band * 0.14, 0.0, 1.0);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         normal = normalize(normal + vec3(0.0, (0.5 - band) * 0.22, 0.0));`
      )
      .replace(
        '#include <opaque_fragment>',
        `if (!gl_FrontFacing) {
           float cell = 22.0;
           vec2 g = abs(fract(vLocal.xz * cell) - 0.5);
           float line = 1.0 - smoothstep(0.0, 0.07, min(g.x, g.y));
           float diag = 1.0 - smoothstep(0.0, 0.07, abs(fract((vLocal.x + vLocal.z) * cell * 0.7071) - 0.5));
           float infill = max(line, diag * 0.7) * uInfill;
           outgoingLight = outgoingLight * (0.5 + 0.28 * infill);
         }
         // Il bordo dello strato in costruzione brilla: è il punto in cui l'ugello sta depositando filo.
         #if NUM_CLIPPING_PLANES > 0
           float hotD = clippingPlanes[0].w - dot(vClipPosition, clippingPlanes[0].xyz);
           float hot = 1.0 - smoothstep(0.0, uHotWidth, hotD);
           outgoingLight = mix(outgoingLight, vec3(1.0, 0.66, 0.3) * 1.5, hot * hot * uHot);
         #endif
         #include <opaque_fragment>`
      );
  };

  material.userData.uniforms = uniforms;
  return material;
}
