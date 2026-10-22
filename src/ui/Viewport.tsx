import { featureLabel } from '@core/data/features';
import { weightIndex } from '@core/nn/model';
import { activationScales, liveModel, liveTrace } from '@state/derived';
import { useLab, type EdgeMode } from '@state/store';
import { CSS_COLORS, formatSigned } from '@viz/encoding';
import { NetworkScene } from '@viz/three/NetworkScene';
import { layerName } from '@viz/three/sceneRefs';
import { ButtonGroup, Segmented } from './controls';
import { useLiveTick } from './hooks';
import styles from './Viewport.module.css';

function Toolbar() {
  const edgeMode = useLab((s) => s.edgeMode);
  const { setEdgeMode, requestCamera } = useLab.getState();
  return (
    <div className={styles.toolbar}>
      <Segmented<EdgeMode>
        label="연결선 표시"
        value={edgeMode}
        onChange={setEdgeMode}
        options={[
          { value: 'weight', label: '가중치 w', title: '연결선 = 가중치' },
          { value: 'contribution', label: '기여도 w·a', title: '연결선 = 현재 입력에 대한 기여도' },
        ]}
      />
      <ButtonGroup
        label="카메라 프리셋"
        onClick={(v) => requestCamera({ kind: 'preset', preset: Number(v) as 1 | 2 | 3 })}
        options={[
          { value: '1', label: '정면', title: '정면 보기 (1)' },
          { value: '2', label: '측면', title: '측면 보기 (2)' },
          { value: '3', label: '등각', title: '등각 보기 (3)' },
        ]}
      />
    </div>
  );
}

function Legend() {
  useLiveTick(4);
  const s = useLab.getState();
  const model = liveModel(s);
  const trace = liveTrace(s);
  let max = 0;
  if (model) {
    for (const L of model.layers)
      for (let j = 0; j < L.outSize; j++)
        for (let i = 0; i < L.inSize; i++) {
          const w = model.params[weightIndex(L, j, i)];
          const v = s.edgeMode === 'contribution' && trace ? w * trace.a[L.index - 1][i] : w;
          max = Math.max(max, Math.abs(v));
        }
  }
  const act = s.config.network.activation;
  const scales = activationScales(s);
  const unbounded = act === 'relu' || act === 'linear';
  const hiddenScale = unbounded && scales.length > 2 ? Math.max(...scales.slice(1, -1)) : null;
  return (
    <div className={styles.legend} aria-label="범례">
      <div className={styles.legendRow}>
        <span className={styles.swatch} style={{ background: CSS_COLORS.positive }} /> 양수
        <span className={styles.swatch} style={{ background: CSS_COLORS.negative }} /> 음수
      </div>
      <div className={styles.legendRow}>
        <span className={styles.lineDemo} />
        {s.edgeMode === 'weight' ? '두께·밝기 = |w|' : '두께·밝기 = |w·a|'}
        <span className="mono">max {max.toFixed(2)}</span>
      </div>
      <div className={styles.legendRow}>
        <span className={styles.dotDemo} />
        뉴런 밝기 = |a|
        <span className="mono">
          {act === 'tanh'
            ? '[−1, 1]'
            : act === 'sigmoid'
              ? '[0, 1]'
              : `p95 ${hiddenScale?.toFixed(2) ?? '—'}`}
        </span>
      </div>
      <div className={styles.legendRow}>
        <span className={styles.ringDemo} /> 링 = 편향 b
      </div>
    </div>
  );
}

function Tooltip() {
  useLiveTick(10);
  const hover = useLab((s) => s.hover);
  const pointer = useLab((s) => s.pointer);
  const s = useLab.getState();
  const model = liveModel(s);
  const trace = liveTrace(s);
  if (!hover || !model || !trace) return null;
  const count = model.sizes.length;
  const name = (l: number, j: number) =>
    l === 0
      ? featureLabel(s.config.network.features[j])
      : l === count - 1
        ? '출력'
        : `${layerName(l, count)} · N${j + 1}`;

  let title: string;
  const rows: [string, number][] = [];
  if (hover.kind === 'neuron') {
    title = name(hover.layer, hover.index);
    rows.push(['a', trace.a[hover.layer][hover.index]]);
    if (hover.layer > 0) {
      rows.push(['z', trace.z[hover.layer][hover.index]]);
      rows.push(['b', model.params[model.layers[hover.layer - 1].bOffset + hover.index]]);
    }
  } else {
    title = `${name(hover.layer - 1, hover.from)} → ${name(hover.layer, hover.to)}`;
    const w = model.params[weightIndex(model.layers[hover.layer - 1], hover.to, hover.from)];
    rows.push(['w', w]);
    rows.push(['w·a', w * trace.a[hover.layer - 1][hover.from]]);
  }
  return (
    <div className={styles.tooltip} style={{ left: pointer.x + 14, top: pointer.y + 14 }} role="tooltip">
      <div className={styles.tipTitle}>{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.tipRow}>
          <span>{k}</span>
          <span className="mono" style={{ color: v >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative }}>
            {formatSigned(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner() {
  const error = useLab((s) => s.error);
  if (!error) return null;
  return <div className={styles.error}>학습 워커 오류: {error}</div>;
}

export function Viewport() {
  const hasHover = useLab((s) => s.hover !== null);
  return (
    <main className={styles.viewport} style={{ cursor: hasHover ? 'pointer' : 'grab' }}>
      <NetworkScene />
      <Toolbar />
      <Legend />
      <Tooltip />
      <ErrorBanner />
    </main>
  );
}
