import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { CameraRig, viewDistance } from './CameraRig';
import { Interaction } from './Interaction';
import { Labels } from './Labels';
import { Network } from './Network';

export function NetworkScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, viewDistance()], fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      data-testid="network-canvas"
    >
      <color attach="background" args={['#05070d']} />
      <Network />
      <Labels />
      <Interaction />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={3} maxDistance={60} />
      <CameraRig />
    </Canvas>
  );
}
