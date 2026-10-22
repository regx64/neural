import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { featureLabel } from '@core/data/features';
import { layerSizesOf, useLab } from '@state/store';
import { computeLayout } from '../layout';
import { layerName } from './sceneRefs';
import styles from './Labels.module.css';

/** Layer names under each layer and feature names next to the input neurons. */
export function Labels() {
  const sizes = useLab(useShallow((s) => layerSizesOf(s.config)));
  const features = useLab((s) => s.config.network.features);
  const key = sizes.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(sizes), [key]);
  const bottom = -layout.height / 2 - 1.1;

  return (
    <group>
      {sizes.map((n, l) => (
        <Html
          key={`layer-${l}`}
          position={[l * 4 - layout.width / 2, bottom, 0]}
          center
          zIndexRange={[10, 0]}
        >
          <div className={styles.layer}>
            {layerName(l, sizes.length)}
            <span>{n}</span>
          </div>
        </Html>
      ))}
      {features.map((f, j) => {
        const p = layout.positions;
        return (
          <Html key={`f-${f}`} position={[p[j * 3] - 0.55, p[j * 3 + 1], p[j * 3 + 2]]} zIndexRange={[10, 0]}>
            <div className={styles.feature}>{featureLabel(f)}</div>
          </Html>
        );
      })}
    </group>
  );
}
