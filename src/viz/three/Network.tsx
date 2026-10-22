import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { useShallow } from 'zustand/react/shallow';
import { liveModel, liveTrace, activationScales } from '@state/derived';
import { layerSizesOf, useLab, type Target } from '@state/store';
import { COLORS, edgeStyle, fadeToWhite, neuronColor, signedActivation, type RGB } from '../encoding';
import { edgeMax, edgeValue } from '../edgeValue';
import { computeLayout, type NetworkLayout } from '../layout';
import { edgeShader, neuronShader, ringShader } from './shaders';
import { sceneRefs } from './sceneRefs';

const SPHERE_RADIUS = 0.28;
/** How much of their colour unrelated elements keep while something is selected. */
const DIM_NEURON = 0.25;
const DIM_EDGE = 0.12;
const PULSE_LAYER_S = 0.25;
/** Only edges carrying at least this share of their layer's largest |w·a| get a pulse. */
const PULSE_MIN = 0.3;
const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Is neuron (l, j) related to the current selection (itself or directly connected)? */
function neuronRelated(sel: Target, l: number, j: number): boolean {
  if (sel.kind === 'neuron') return (l === sel.layer && j === sel.index) || Math.abs(l - sel.layer) === 1;
  return (l === sel.layer - 1 && j === sel.from) || (l === sel.layer && j === sel.to);
}

function edgeRelated(sel: Target, l: number, from: number, to: number): boolean {
  if (sel.kind === 'neuron')
    return (l === sel.layer && to === sel.index) || (l === sel.layer + 1 && from === sel.index);
  return l === sel.layer && from === sel.from && to === sel.to;
}

const sameTarget = (a: Target | null, b: Target | null) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  a.layer === b.layer &&
  (a.kind === 'neuron'
    ? a.index === (b as typeof a).index
    : a.from === (b as typeof a).from && a.to === (b as typeof a).to);

function makeRingMaterial(inner: number, outer: number) {
  return new ShaderMaterial({
    ...ringShader,
    uniforms: { uInner: { value: inner }, uOuter: { value: outer } },
    transparent: true,
    depthWrite: false,
  });
}

function makeInstanced(geometry: SphereGeometry | PlaneGeometry, material: ShaderMaterial, count: number) {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3);
  mesh.instanceColor.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}

function makeEdgeGeometry(count: number) {
  const g = new InstancedBufferGeometry();
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = Math.max(1, count);
  const attr = (size: number) =>
    new InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(DynamicDrawUsage);
  g.setAttribute('aStart', attr(3));
  g.setAttribute('aEnd', attr(3));
  g.setAttribute('aColor', attr(3));
  g.setAttribute('aWidth', attr(1));
  g.setAttribute('aAlpha', attr(1));
  g.instanceCount = count;
  return g;
}

/** Animated display positions: neurons glide to new slots when the structure changes. */
function useAnimatedLayout(layout: NetworkLayout) {
  const anim = useRef<{ layout: NetworkLayout; current: Float32Array; scale: Float32Array } | null>(null);
  useEffect(() => {
    const prev = anim.current;
    const current = layout.positions.slice();
    const scale = new Float32Array(layout.neuronCount);
    const last = layout.sizes.length - 1;
    for (let l = 0; l <= last; l++) {
      for (let j = 0; j < layout.sizes[l]; j++) {
        const g = layout.neuronOffsets[l] + j;
        if (!prev) {
          scale[g] = 1;
          continue;
        }
        const prevLast = prev.layout.sizes.length - 1;
        // The output layer maps to the previous output layer; others by index.
        const pl = l === last ? prevLast : l < prevLast ? l : -1;
        if (pl >= 0 && j < prev.layout.sizes[pl]) {
          const pg = prev.layout.neuronOffsets[pl] + j;
          current.set(prev.current.subarray(pg * 3, pg * 3 + 3), g * 3);
          scale[g] = prev.scale[pg];
        }
      }
    }
    anim.current = { layout, current, scale };
    sceneRefs.layout = layout;
    sceneRefs.positions = current;
  }, [layout]);
  return anim;
}

export function Network() {
  const sizes = useLab(useShallow((s) => layerSizesOf(s.config)));
  const key = sizes.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(sizes), [key]);
  const anim = useAnimatedLayout(layout);
  const pulseRef = useRef<{ point: [number, number] | null; start: number }>({ point: null, start: -10 });

  const meshes = useMemo(() => {
    const n = layout.neuronCount;
    const sphere = makeInstanced(
      new SphereGeometry(SPHERE_RADIUS, 32, 20),
      new ShaderMaterial({ ...neuronShader }),
      n,
    );
    const ring = makeInstanced(new PlaneGeometry(1, 1), makeRingMaterial(0.76, 0.84), n);
    const marker = makeInstanced(new PlaneGeometry(1, 1), makeRingMaterial(0.8, 0.9), 2);
    // Filled discs (ring with no hole) that travel along edges: the signal flow.
    const pulse = makeInstanced(new PlaneGeometry(1, 1), makeRingMaterial(0, 0.9), layout.edgeCount);
    const edgeGeometry = makeEdgeGeometry(layout.edgeCount);
    const edgeMaterial = new ShaderMaterial({
      ...edgeShader,
      uniforms: { uResolution: { value: new Vector2(1, 1) } },
      transparent: true,
      depthWrite: false,
    });
    return { sphere, ring, marker, pulse, edgeGeometry, edgeMaterial };
  }, [layout]);

  useEffect(() => {
    sceneRefs.spheres = meshes.sphere;
    return () => {
      for (const m of [meshes.sphere, meshes.ring, meshes.marker, meshes.pulse]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
        m.dispose();
      }
      meshes.edgeGeometry.dispose();
      meshes.edgeMaterial.dispose();
      if (sceneRefs.spheres === meshes.sphere) sceneRefs.spheres = null;
    };
  }, [meshes]);

  const tmp = useMemo(
    () => ({
      m: new Matrix4(),
      v: new Vector3(),
      c: new Color(),
      rgb: [0, 0, 0] as RGB,
      out: [0, 0, 0] as RGB,
    }),
    [],
  );

  useFrame((state, dt) => {
    const a = anim.current;
    if (!a || a.layout !== layout) return;
    const { sphere, ring, marker, edgeGeometry, edgeMaterial } = meshes;
    edgeMaterial.uniforms.uResolution.value.set(state.size.width, state.size.height);
    const s = useLab.getState();
    const model = liveModel(s);
    const trace = liveTrace(s);
    const scales = activationScales(s);
    const { sizes, neuronOffsets, edgeOffsets } = layout;
    const last = sizes.length - 1;
    const sel = s.selection;
    const hover = s.hover;
    const setColor = (mesh: InstancedMesh, i: number, c: RGB) =>
      mesh.setColorAt(i, tmp.c.setRGB(c[0], c[1], c[2]));

    // 1. Animate neuron positions/scales toward the layout targets.
    const k = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < a.current.length; i++) a.current[i] += (layout.positions[i] - a.current[i]) * k;
    for (let g = 0; g < a.scale.length; g++) a.scale[g] += (1 - a.scale[g]) * k;

    // 2. Neurons: colour = activation, ring = bias.
    let maxBias = 0;
    if (model)
      for (const L of model.layers)
        for (let j = 0; j < L.outSize; j++)
          maxBias = Math.max(maxBias, Math.abs(model.params[L.bOffset + j]));

    for (let l = 0; l <= last; l++) {
      const act = l === 0 ? 'input' : l === last ? 'sigmoid' : s.config.network.activation;
      for (let j = 0; j < sizes[l]; j++) {
        const g = neuronOffsets[l] + j;
        const sv = trace ? signedActivation(trace.a[l][j], act, scales[l] ?? 1) : 0;
        const dim = sel && !neuronRelated(sel, l, j) ? DIM_NEURON : 1;
        const hovered = hover?.kind === 'neuron' && hover.layer === l && hover.index === j;
        const size = a.scale[g] * (l === 0 || l === last ? 1.15 : 1) * (hovered ? 1.15 : 1);
        tmp.v.fromArray(a.current, g * 3);

        tmp.m.makeScale(size, size, size).setPosition(tmp.v);
        sphere.setMatrixAt(g, tmp.m);
        setColor(sphere, g, fadeToWhite(neuronColor(sv, tmp.rgb), dim, tmp.out));

        const rs = size * 0.9;
        tmp.m.makeScale(rs, rs, rs).setPosition(tmp.v);
        ring.setMatrixAt(g, tmp.m);
        let ri = 0;
        let rc = COLORS.neutral;
        if (model && l > 0 && maxBias > 0) {
          const b = model.params[model.layers[l - 1].bOffset + j];
          ri = (Math.abs(b) / maxBias) * 0.6 * dim;
          rc = b >= 0 ? COLORS.positive : COLORS.negative;
        }
        setColor(ring, g, fadeToWhite(rc, ri, tmp.out));
      }
    }
    sphere.instanceMatrix.needsUpdate = true;
    sphere.instanceColor!.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;
    ring.instanceColor!.needsUpdate = true;

    // 3. Edges: the mode's value (w, w·a or −∂L/∂w) → colour sign, width + opacity magnitude.
    const attrs = edgeGeometry.attributes;
    const aStart = attrs.aStart.array as Float32Array;
    const aEnd = attrs.aEnd.array as Float32Array;
    const aColor = attrs.aColor.array as Float32Array;
    const aWidth = attrs.aWidth.array as Float32Array;
    const aAlpha = attrs.aAlpha.array as Float32Array;
    const gradMean = s.live.gradMean;
    const maxAbs = model ? edgeMax(s.edgeMode, model, trace, gradMean) : 0;
    for (let l = 1; l <= last; l++) {
      const nIn = sizes[l - 1];
      const L = model?.layers[l - 1];
      for (let j = 0; j < sizes[l]; j++) {
        for (let i = 0; i < nIn; i++) {
          const e = edgeOffsets[l] + j * nIn + i;
          const v = L ? edgeValue(s.edgeMode, model!, trace, gradMean, l, j, i) : 0;
          const st = edgeStyle(v, maxAbs);
          const from = neuronOffsets[l - 1] + i;
          const to = neuronOffsets[l] + j;
          aStart.set(a.current.subarray(from * 3, from * 3 + 3), e * 3);
          aEnd.set(a.current.subarray(to * 3, to * 3 + 3), e * 3);
          const c = st.positive ? COLORS.positive : COLORS.negative;
          aColor[e * 3] = c[0];
          aColor[e * 3 + 1] = c[1];
          aColor[e * 3 + 2] = c[2];
          let width = st.width;
          let alpha = st.alpha * Math.min(a.scale[from], a.scale[to]);
          if (sel && !edgeRelated(sel, l, i, j)) alpha *= DIM_EDGE;
          const isHover = hover?.kind === 'edge' && hover.layer === l && hover.from === i && hover.to === j;
          const isSel = sel?.kind === 'edge' && sel.layer === l && sel.from === i && sel.to === j;
          if (isHover || isSel) {
            width = Math.max(width * 1.5, 3);
            alpha = Math.max(alpha, 0.95);
          }
          aWidth[e] = width;
          aAlpha[e] = alpha;
        }
      }
    }
    for (const name of ['aStart', 'aEnd', 'aColor', 'aWidth', 'aAlpha']) attrs[name].needsUpdate = true;

    // 4. Selection / hover markers.
    const markerFor = (t: Target | null, slot: number, strength: number) => {
      let size = 0;
      if (t) {
        if (t.kind === 'neuron') {
          tmp.v.fromArray(a.current, (neuronOffsets[t.layer] + t.index) * 3);
          size = 1.05;
        } else {
          const p = neuronOffsets[t.layer - 1] + t.from;
          const q = neuronOffsets[t.layer] + t.to;
          tmp.v.set(
            (a.current[p * 3] + a.current[q * 3]) / 2,
            (a.current[p * 3 + 1] + a.current[q * 3 + 1]) / 2,
            (a.current[p * 3 + 2] + a.current[q * 3 + 2]) / 2,
          );
          size = 0.45;
        }
      }
      tmp.m.makeScale(size, size, size).setPosition(tmp.v);
      marker.setMatrixAt(slot, tmp.m);
      setColor(marker, slot, fadeToWhite(COLORS.ink, strength, tmp.out));
    };
    markerFor(sel, 0, 1);
    markerFor(sameTarget(hover, sel) ? null : hover, 1, 0.35);
    marker.instanceMatrix.needsUpdate = true;
    marker.instanceColor!.needsUpdate = true;

    // 5. Signal flow: when the probe input changes, a wave travels input → output, one layer per
    // PULSE_LAYER_S. Each edge's dot size is its share of the layer's largest |w·a|.
    const { pulse } = meshes;
    const now = state.clock.elapsedTime;
    if (pulseRef.current.point !== s.probe.point) {
      pulseRef.current = { point: s.probe.point, start: now };
    }
    const progress = (now - pulseRef.current.start) / PULSE_LAYER_S;
    const pulsesOn = s.showPulses && !REDUCED_MOTION && model && trace && progress < last + 1;
    for (let l = 1; l <= last; l++) {
      const nIn = sizes[l - 1];
      const local = progress - (l - 1);
      const active = pulsesOn && local > 0 && local < 1;
      let layerMax = 0;
      if (active)
        for (let j = 0; j < sizes[l]; j++)
          for (let i = 0; i < nIn; i++)
            layerMax = Math.max(layerMax, Math.abs(edgeValue('contribution', model!, trace, null, l, j, i)));
      for (let j = 0; j < sizes[l]; j++) {
        for (let i = 0; i < nIn; i++) {
          const e = edgeOffsets[l] + j * nIn + i;
          let size = 0;
          if (active && layerMax > 0) {
            const c = edgeValue('contribution', model!, trace, null, l, j, i);
            const strength = Math.abs(c) / layerMax;
            if (strength >= PULSE_MIN) {
              const from = (neuronOffsets[l - 1] + i) * 3;
              const to = (neuronOffsets[l] + j) * 3;
              tmp.v.set(
                a.current[from] + (a.current[to] - a.current[from]) * local,
                a.current[from + 1] + (a.current[to + 1] - a.current[from + 1]) * local,
                a.current[from + 2] + (a.current[to + 2] - a.current[from + 2]) * local,
              );
              size = (0.12 + 0.18 * strength) * Math.sin(Math.PI * local);
              const col = c >= 0 ? COLORS.positive : COLORS.negative;
              setColor(
                pulse,
                e,
                sel && !edgeRelated(sel, l, i, j) ? fadeToWhite(col, DIM_NEURON, tmp.out) : col,
              );
            }
          }
          tmp.m.makeScale(size, size, size).setPosition(tmp.v);
          pulse.setMatrixAt(e, tmp.m);
        }
      }
    }
    pulse.instanceMatrix.needsUpdate = true;
    pulse.instanceColor!.needsUpdate = true;
  });

  return (
    <group>
      <mesh
        geometry={meshes.edgeGeometry}
        material={meshes.edgeMaterial}
        frustumCulled={false}
        renderOrder={1}
      />
      <primitive object={meshes.sphere} />
      <primitive object={meshes.ring} renderOrder={2} />
      <primitive object={meshes.marker} renderOrder={3} />
      <primitive object={meshes.pulse} renderOrder={4} />
    </group>
  );
}
