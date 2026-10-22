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
/** Matches the CSS phone breakpoint (the canvas is about the window width there). */
const MOBILE_MAX_WIDTH = 880;

const FOV = 45;

/** Distance at which the whole network fits the view, horizontally and vertically. */
/**
 * Distance at which the whole network fits the view, horizontally and vertically. `usable` is
 * the fraction of the height not covered by overlays (stats on top, player bar at the bottom).
 */
export function viewDistance(aspect = 1.6, usable = 1): number {
  const layout = sceneRefs.layout;
  const width = (layout ? layout.width : 8) + 3;
  const height = (layout ? layout.height : 4) + 3.5;
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);
  const fitH = height / 2 / tanV / usable;
  const fitW = width / 2 / (tanV * Math.max(0.3, aspect));
  return Math.max(9, fitW, fitH) * 1.08;
}

/** Phones: stats (+ narration when tall enough) on top, the player bar at the bottom. */
const MOBILE_BOTTOM_PX = 70;
const mobileTopPx = (height: number) => (height < 380 ? 64 : 130);

function fitFor(width: number, height: number): number {
  const aspect = width / Math.max(1, height);
  if (width > MOBILE_MAX_WIDTH) return viewDistance(aspect);
  const usable = Math.max(0.4, (height - mobileTopPx(height) - MOBILE_BOTTOM_PX) / Math.max(1, height));
  return viewDistance(aspect, usable);
}

/** Has the learner turned the view noticeably away from the front? (shows a "정면 보기" chip) */
const TURNED_DEG = 18;

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
  const getState = useThree((s) => s.get);
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
  const aspectBucket = Math.round((size.width / Math.max(1, size.height)) * 4);
  useEffect(() => {
    if (!controls) return;
    const id = requestAnimationFrame(() => {
      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const toTarget = new Vector3(0, 0, 0);
      const dir = fromPos.clone().sub(fromTarget).normalize();
      const { width, height } = getState().size;
      const toPos = dir.multiplyScalar(fitFor(width, height));
      anim.current = { fromPos, toPos, fromTarget, toTarget, t: 0 };
    });
    return () => cancelAnimationFrame(id);
    // Refit when layers are added/removed or the view's shape changes (e.g. phone rotation).
  }, [layerCount, camera, controls, aspectBucket, getState]);

  useEffect(() => {
    if (!request || !controls) return;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    let toPos: Vector3;
    let toTarget: Vector3;
    if (request.kind === 'preset') {
      useLab.setState({ cameraTurned: request.preset !== 1 });
      toTarget = new Vector3(0, 0, 0);
      const { width, height } = getState().size;
      toPos = presetPosition(request.preset ?? 1, fitFor(width, height));
    } else {
      toTarget = new Vector3(...(request.target ?? [0, 0, 0]));
      const dir = fromPos.clone().sub(fromTarget).normalize();
      toPos = toTarget.clone().add(dir.multiplyScalar(FOCUS_DISTANCE));
    }
    anim.current = { fromPos, toPos, fromTarget, toTarget, t: 0 };
  }, [request, camera, controls, getState]);

  // Report orientation changes from the learner's own dragging.
  useEffect(() => {
    if (!controls) return;
    const c = controls as unknown as Controls & {
      addEventListener(t: string, f: () => void): void;
      removeEventListener(t: string, f: () => void): void;
    };
    const onEnd = () => {
      const dir = camera.position.clone().sub(c.target).normalize();
      const turned = (Math.acos(Math.min(1, Math.max(-1, dir.z))) * 180) / Math.PI > TURNED_DEG;
      if (useLab.getState().cameraTurned !== turned) useLab.setState({ cameraTurned: turned });
    };
    c.addEventListener('end', onEnd);
    return () => c.removeEventListener('end', onEnd);
  }, [controls, camera]);

  useFrame((_, dt) => {
    // Slide the rendered view so the network stays clear of the floating inspector.
    // Desktop: the inspector sits on the right → slide left. Phones: it sits on top → slide down.
    const mobile = size.width <= MOBILE_MAX_WIDTH;
    // Phones always nudge the network down so the overlays above and below don't cover it.
    const base = mobile ? (mobileTopPx(size.height) - MOBILE_BOTTOM_PX) / 2 : 0;
    const target = useLab.getState().selection ? (mobile ? size.height * 0.26 : INSPECTOR_SHIFT) : base;
    shift.current += (target - shift.current) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - shift.current) < 0.5) shift.current = target;
    const pc = camera as typeof camera & {
      view?: { enabled: boolean } | null;
      setViewOffset?: (...a: number[]) => void;
      clearViewOffset?: () => void;
    };
    // Re-applied every frame while shifted so it follows canvas resizes.
    if (shift.current !== 0)
      pc.setViewOffset?.(
        size.width,
        size.height,
        mobile ? 0 : shift.current,
        mobile ? -shift.current : 0,
        size.width,
        size.height,
      );
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
