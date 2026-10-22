import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Raycaster, Vector2, Vector3 } from 'three';
import { useLab, type Target } from '@state/store';
import { neuronAt, sceneRefs } from './sceneRefs';

const EDGE_PICK_PX = 6;
const CLICK_SLOP_PX = 5;

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Pointer picking for the network: neurons by ray cast against the instanced spheres, edges by
 * screen-space distance to their projected segments. Also exposes a small test hook.
 */
export function Interaction() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const v = new Vector3();
    let screen = new Float32Array(0);

    const projectAll = (w: number, h: number) => {
      const pos = sceneRefs.positions;
      if (screen.length !== (pos.length / 3) * 2) screen = new Float32Array((pos.length / 3) * 2);
      for (let g = 0; g < pos.length / 3; g++) {
        v.fromArray(pos, g * 3).project(camera);
        screen[g * 2] = ((v.x + 1) / 2) * w;
        screen[g * 2 + 1] = ((1 - v.y) / 2) * h;
      }
    };

    const pick = (clientX: number, clientY: number): Target | null => {
      const layout = sceneRefs.layout;
      if (!layout) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
      if (sceneRefs.spheres) {
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(sceneRefs.spheres, false)[0];
        if (hit?.instanceId !== undefined) {
          const n = neuronAt(layout, hit.instanceId);
          return { kind: 'neuron', layer: n.layer, index: n.index };
        }
      }
      projectAll(rect.width, rect.height);
      let best: Target | null = null;
      let bestD = EDGE_PICK_PX;
      const { sizes, neuronOffsets } = layout;
      for (let l = 1; l < sizes.length; l++) {
        for (let j = 0; j < sizes[l]; j++) {
          const b = neuronOffsets[l] + j;
          for (let i = 0; i < sizes[l - 1]; i++) {
            const a = neuronOffsets[l - 1] + i;
            const d = distToSegment(x, y, screen[a * 2], screen[a * 2 + 1], screen[b * 2], screen[b * 2 + 1]);
            if (d < bestD) {
              bestD = d;
              best = { kind: 'edge', layer: l, from: i, to: j };
            }
          }
        }
      }
      return best;
    };

    let down: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 0) return; // dragging the camera
      const rect = el.getBoundingClientRect();
      useLab
        .getState()
        .setHover(pick(e.clientX, e.clientY), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.button !== 0) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) <= CLICK_SLOP_PX) {
        useLab.getState().select(pick(e.clientX, e.clientY));
        // The view slides when the inspector opens, so the old hover target is no longer under the pointer.
        useLab.getState().setHover(null);
      }
      down = null;
    };
    const onDouble = (e: MouseEvent) => {
      const t = pick(e.clientX, e.clientY);
      const layout = sceneRefs.layout;
      if (!t || !layout) return;
      const g =
        t.kind === 'neuron' ? layout.neuronOffsets[t.layer] + t.index : layout.neuronOffsets[t.layer] + t.to;
      const p = sceneRefs.positions;
      useLab.getState().requestCamera({ kind: 'focus', target: [p[g * 3], p[g * 3 + 1], p[g * 3 + 2]] });
    };
    const onLeave = () => useLab.getState().setHover(null);

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('dblclick', onDouble);
    el.addEventListener('pointerleave', onLeave);

    // Test hook: client coordinates of a neuron, used by the E2E suite to click it.
    (window as unknown as { __NEURAL__: unknown }).__NEURAL__ = {
      neuronClientPosition(layer: number, index: number) {
        const layout = sceneRefs.layout;
        if (!layout) return null;
        const rect = el.getBoundingClientRect();
        const g = layout.neuronOffsets[layer] + index;
        v.fromArray(sceneRefs.positions, g * 3).project(camera);
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    };

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('dblclick', onDouble);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [camera, gl]);

  return null;
}
