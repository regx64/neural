import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { CameraRig, viewDistance } from './CameraRig';
import { Interaction } from './Interaction';
import { Labels } from './Labels';
import { Network } from './Network';

/** `onContextLost` fires when the browser drops the WebGL context (GPU reset, sleep, too many tabs). */
export function NetworkScene({ onContextLost }: { onContextLost?: () => void }) {
  return (
    <Canvas
      camera={{ position: [0, 0, viewDistance()], fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      data-testid="network-canvas"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <color attach="background" args={['#ffffff']} />
      <Network />
      <Labels />
      <Interaction />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={3} maxDistance={60} />
      <CameraRig />
    </Canvas>
  );
}
