import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useLab } from '@state/store';
import { sceneRefs } from './sceneRefs';

/** The subset of OrbitControls this rig drives. */
interface Controls {
  target: Vector3;
  update(): void;
}

const DURATION = 0.7;
const FOCUS_DISTANCE = 6;
/** Half the inspector card width (+ margin): the scene slides left by this much while it is open. */
const INSPECTOR_SHIFT = 172;

export function viewDistance(): number {
  const layout = sceneRefs.layout;
  const span = layout ? Math.max(layout.width, layout.height * 1.6) : 8;
  return Math.max(9, span * 1.1 + 5);
}

function presetPosition(preset: 1 | 2 | 3, d: number): Vector3 {
  switch (preset) {
    case 1:
      return new Vector3(0, 0, d);
    case 2:
      return new Vector3(-d * 0.95, d * 0.08, d * 0.12);
    case 3:
      return new Vector3(d * 0.55, d * 0.42, d * 0.72);
  }
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** Animates the camera to preset views and focus targets requested through the store. */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const shift = useRef(0);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const request = useLab((s) => s.camera);
  const anim = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    t: number;
  } | null>(null);

  // Keep the whole network in view when layers are added or removed (direction is preserved).
  const layerCount = useLab((s) => s.config.network.hidden.length);
  useEffect(() => {
    if (!controls) return;
    const id = requestAnimationFrame(() => {
      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const toTarget = new Vector3(0, 0, 0);
      const dir = fromPos.clone().sub(fromTarget).normalize();
      anim.current = { fromPos, toPos: dir.multiplyScalar(viewDistance()), fromTarget, toTarget, t: 0 };
    });
    return () => cancelAnimationFrame(id);
  }, [layerCount, camera, controls]);

  useEffect(() => {
    if (!request || !controls) return;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    let toPos: Vector3;
    let toTarget: Vector3;
    if (request.kind === 'preset') {
      toTarget = new Vector3(0, 0, 0);
      toPos = presetPosition(request.preset ?? 1, viewDistance());
    } else {
      toTarget = new Vector3(...(request.target ?? [0, 0, 0]));
      const dir = fromPos.clone().sub(fromTarget).normalize();
      toPos = toTarget.clone().add(dir.multiplyScalar(FOCUS_DISTANCE));
    }
    anim.current = { fromPos, toPos, fromTarget, toTarget, t: 0 };
  }, [request, camera, controls]);

  useFrame((_, dt) => {
    // Slide the rendered view so the network stays clear of the floating inspector.
    const target = useLab.getState().selection ? INSPECTOR_SHIFT : 0;
    shift.current += (target - shift.current) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - shift.current) < 0.5) shift.current = target;
    const pc = camera as typeof camera & {
      view?: { enabled: boolean } | null;
      setViewOffset?: (...a: number[]) => void;
      clearViewOffset?: () => void;
    };
    // Re-applied every frame while shifted so it follows canvas resizes.
    if (shift.current !== 0)
      pc.setViewOffset?.(size.width, size.height, shift.current, 0, size.width, size.height);
    else if (pc.view?.enabled) pc.clearViewOffset?.();

    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / DURATION);
    const k = ease(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });

  return null;
}
