import { featureLabel } from '@core/data/features';
import { weightIndex } from '@core/nn/model';
import { activationScales, liveModel, liveTrace } from '@state/derived';
import { useLab, type EdgeMode } from '@state/store';
import type { Speed } from '@worker/protocol';
import { CSS_COLORS, formatNumber, formatSigned } from '@viz/encoding';
import { NetworkScene } from '@viz/three/NetworkScene';
import { layerName } from '@viz/three/sceneRefs';
import { Segmented } from './controls';
import { useLiveTick } from './hooks';
import { PauseIcon, PlayIcon, ResetIcon, StepIcon } from './icons';
import { Inspector } from './Inspector';
import styles from './Viewport.module.css';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 5, label: '느리게' },
  { value: 15, label: '천천히' },
  { value: 50, label: '보통' },
  { value: 150, label: '빠르게' },
  { value: 'max', label: '최대' },
];

const pct = (v: number | undefined) =>
  v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;

function Stats() {
  useLiveTick(15);
  const { metrics } = useLab.getState().live;
  const stats = [
    { label: 'Epoch', value: metrics ? metrics.epoch.toLocaleString() : '0', id: 'epoch' },
    {
      label: '손실',
      value: metrics ? formatNumber(metrics.trainLoss) : '—',
      id: 'train-loss',
      sub: metrics ? formatNumber(metrics.testLoss) : '—',
      subId: 'test-loss',
    },
    {
      label: '정확도',
      value: pct(metrics?.trainAccuracy),
      id: 'train-acc',
      sub: pct(metrics?.testAccuracy),
      subId: 'test-acc',
    },
  ];
  return (
    <dl className={styles.stats}>
      {stats.map((m) => (
        <div key={m.id}>
          <dt>{m.label}</dt>
          <dd className="num" data-testid={`metric-${m.id}`}>
            {m.value}
          </dd>
          {m.subId && (
            <dd className={`num ${styles.sub}`}>
              검증 <span data-testid={`metric-${m.subId}`}>{m.sub}</span>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function Player() {
  const running = useLab((s) => s.live.running);
  const speed = useLab((s) => s.speed);
  const edgeMode = useLab((s) => s.edgeMode);
  const { togglePlay, step, reset, setSpeed, setEdgeMode } = useLab.getState();
  return (
    <div className={styles.player} role="toolbar" aria-label="학습 제어">
      <button
        type="button"
        className={styles.icon}
        onClick={reset}
        title="초기화 (R)"
        aria-label="가중치 초기화"
      >
        <ResetIcon width={17} height={17} />
      </button>
      <button
        type="button"
        className={styles.play}
        onClick={togglePlay}
        aria-label={running ? '일시정지' : '학습 시작'}
        title={running ? '일시정지 (Space)' : '학습 시작 (Space)'}
        data-testid="play"
      >
        {running ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
      </button>
      <button
        type="button"
        className={styles.icon}
        onClick={step}
        title="1 에폭 (.)"
        aria-label="1 에폭 진행"
      >
        <StepIcon width={17} height={17} />
      </button>
      <span className={styles.divider} />
      <Segmented<EdgeMode>
        label="연결선 표시"
        value={edgeMode}
        onChange={setEdgeMode}
        options={[
          { value: 'weight', label: '가중치', title: '연결선 = 가중치 w' },
          { value: 'contribution', label: '기여도', title: '연결선 = 현재 입력의 기여도 w·a' },
        ]}
      />
      <span className={styles.divider} />
      <select
        className={styles.speed}
        aria-label="학습 속도"
        value={String(speed)}
        onChange={(e) => setSpeed(e.target.value === 'max' ? 'max' : Number(e.target.value))}
      >
        {SPEEDS.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
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
      <div>
        <span>
          <i style={{ background: CSS_COLORS.positive }} />
          양수
        </span>
        <span>
          <i style={{ background: CSS_COLORS.negative }} />
          음수
        </span>
      </div>
      <div className="num">
        굵기 |{s.edgeMode === 'weight' ? 'w' : 'w·a'}| · 최대 {max.toFixed(2)}
        {unbounded && ` · 활성화 p95 ${hiddenScale?.toFixed(2) ?? '—'}`}
      </div>
    </div>
  );
}

function Hint() {
  const hasSelection = useLab((s) => s.selection !== null);
  if (hasSelection) return null;
  return <p className={styles.hint}>뉴런이나 연결을 클릭하면 계산 과정을 볼 수 있습니다.</p>;
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
          <span className="num" style={{ color: v >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative }}>
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
    <main className={styles.wrap}>
      <div className={styles.viewport} style={{ cursor: hasHover ? 'pointer' : 'grab' }}>
        <NetworkScene />
        <Stats />
        <Inspector />
        <Legend />
        <Hint />
        <Player />
        <Tooltip />
        <ErrorBanner />
      </div>
    </main>
  );
}
