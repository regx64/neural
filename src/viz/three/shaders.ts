/** Softly lit sphere with a slightly darker rim so pale neurons stay defined on white. */
export const neuronShader = {
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vColor;
    void main() {
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      vView = normalize(-mv.xyz);
      vColor = instanceColor;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vColor;
    void main() {
      vec3 n = normalize(vNormal);
      float ndl = max(dot(n, normalize(vec3(0.3, 0.6, 1.0))), 0.0);
      float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.0);
      vec3 c = vColor * (0.86 + 0.14 * ndl);
      c = mix(c, vColor * 0.72, rim * 0.7);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

/** Camera-facing annulus between uInner and uOuter (in quad radii), sized by the instance scale. */
export const ringShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float scale = length(instanceMatrix[0].xyz);
      vUv = position.xy * 2.0;
      vColor = instanceColor;
      gl_Position = projectionMatrix * (center + vec4(position.xy * scale, 0.0, 0.0));
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uInner;
    uniform float uOuter;
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      float r = length(vUv);
      float a = smoothstep(uInner - 0.04, uInner, r) * (1.0 - smoothstep(uOuter, uOuter + 0.04, r));
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor, a);
    }
  `,
};

/**
 * Instanced screen-space ribbons: a unit quad stretched from aStart to aEnd and widened
 * perpendicular to the edge on screen, so aWidth is in CSS pixels (like three's Line2).
 */
export const edgeShader = {
  vertexShader: /* glsl */ `
    uniform vec2 uResolution;
    attribute vec3 aStart;
    attribute vec3 aEnd;
    attribute vec3 aColor;
    attribute float aWidth;
    attribute float aAlpha;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSide;
    void main() {
      vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
      vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
      vec2 screenDir = (clipEnd.xy / clipEnd.w - clipStart.xy / clipStart.w) * uResolution;
      screenDir /= max(length(screenDir), 1e-4);
      vec2 normal = vec2(-screenDir.y, screenDir.x);
      vec4 clip = mix(clipStart, clipEnd, position.x);
      // +1px so the soft falloff in the fragment shader doesn't eat thin lines.
      clip.xy += normal * position.y * (aWidth + 1.0) / uResolution * 2.0 * clip.w;
      vSide = position.y * 2.0;
      vColor = aColor;
      vAlpha = aAlpha;
      gl_Position = clip;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSide;
    void main() {
      float edge = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
      gl_FragColor = vec4(vColor, vAlpha * edge);
    }
  `,
};
