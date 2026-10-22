import { useEffect, useRef, useState } from 'react';
import { DATASETS, generateDataset, type DatasetId } from '@core/data/datasets';
import { FEATURES, type FeatureId } from '@core/data/features';
import { buildLayout } from '@core/nn/model';
import type { ActivationId } from '@core/nn/activations';
import type { OptimizerId } from '@core/nn/optimizers';
import { LIMITS } from '@core/train/config';
import { useLab } from '@state/store';
import { DecisionBoundary } from '@viz/canvas2d/DecisionBoundary';
import { CHART_COLORS, MetricChart, type ChartKind } from '@viz/canvas2d/MetricChart';
import { CSS_COLORS } from '@viz/encoding';
import { Card, Disclosure, Field, Row, Segmented, Select, Slider, Stepper } from './controls';
import { PlusIcon } from './icons';
import { LessonCard } from './LessonCard';
import { Term } from './Term';
import styles from './Sidebar.module.css';

const PLOT_SIZE = 244;
const LEARNING_RATES = [0.0001, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
const BATCH_SIZES = [1, 4, 10, 30, 0];
const OPTIMIZER_LABELS: Record<OptimizerId, string> = { sgd: 'SGD', momentum: 'Momentum', adam: 'Adam' };
const ACTIVATIONS: { value: ActivationId; label: string }[] = [
  { value: 'tanh', label: 'tanh' },
  { value: 'relu', label: 'ReLU' },
  { value: 'sigmoid', label: 'Sigmoid' },
  { value: 'linear', label: 'Linear' },
];

/** Small preview of each dataset's shape, drawn from the real generator. */
function DatasetThumb({ id }: { id: DatasetId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = c.clientWidth;
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const d = generateDataset({ id, samples: 70, noise: 0.03, trainRatio: 0.7 }, 7);
    for (let s = 0; s < d.count; s++) {
      ctx.fillStyle = d.labels[s] ? CSS_COLORS.positive : CSS_COLORS.negative;
      ctx.beginPath();
      ctx.arc(
        ((d.points[2 * s] + 1) / 2) * size,
        ((1 - d.points[2 * s + 1]) / 2) * size,
        1.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }, [id]);
  return <canvas ref={ref} className={styles.thumb} aria-hidden />;
}

function DataCard() {
  const datasetId = useLab((s) => s.config.dataset.id);
  const probe = useLab((s) => s.probe);
  const drawMode = useLab((s) => s.drawMode);
  const drawClass = useLab((s) => s.drawClass);
  const { setDataset, setProbeAuto, setDrawMode, setDrawClass, editPoints } = useLab.getState();
  return (
    <Card title="데이터" tour="data">
      <div className={styles.picker} role="radiogroup" aria-label="데이터셋">
        {DATASETS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={d.id === datasetId}
            className={d.id === datasetId ? styles.tileActive : styles.tile}
            onClick={() => {
              setDrawMode(false);
              setDataset({ id: d.id });
            }}
          >
            <DatasetThumb id={d.id} />
            <span>{d.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={datasetId === 'custom'}
          className={datasetId === 'custom' ? styles.tileActive : styles.tile}
          onClick={() => {
            // A blank canvas to draw on.
            editPoints([], []);
            useLab.setState({ drawMode: true });
          }}
        >
          <span className={styles.thumbDraw} aria-hidden>
            <PlusIcon width={14} height={14} />
          </span>
          <span>직접</span>
        </button>
      </div>
      <DecisionBoundary size={PLOT_SIZE} />
      <div className={styles.drawBar} data-tour="draw">
        <Segmented<'look' | 'draw'>
          label="데이터 그림 모드"
          value={drawMode ? 'draw' : 'look'}
          onChange={(v) => setDrawMode(v === 'draw')}
          options={[
            { value: 'look', label: '살펴보기' },
            { value: 'draw', label: '점 찍기' },
          ]}
        />
        {drawMode && (
          <div className={styles.classPick} role="radiogroup" aria-label="찍을 점의 색">
            {([1, 0] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={drawClass === c}
                aria-label={c === 1 ? '파란 점' : '주황 점'}
                className={drawClass === c ? styles.swatchOn : styles.swatch}
                style={{ background: c === 1 ? CSS_COLORS.positive : CSS_COLORS.negative }}
                onClick={() => setDrawClass(c)}
              />
            ))}
          </div>
        )}
      </div>
      {drawMode ? (
        <div className={styles.probe}>
          <span>클릭: 추가 · Shift+클릭: 지우기</span>
          <button type="button" className={styles.link} onClick={() => editPoints([], [])}>
            모두 지우기
          </button>
        </div>
      ) : (
        <div className={styles.probe}>
          <span className="num">
            <Term id="probe">입력</Term>{' '}
            {probe.point ? `(${probe.point[0].toFixed(2)}, ${probe.point[1].toFixed(2)})` : '—'}
          </span>
          {probe.auto ? (
            <span>샘플 순회 중</span>
          ) : (
            <button type="button" className={styles.link} onClick={() => setProbeAuto(true)}>
              샘플 순회
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function NetworkCard() {
  const network = useLab((s) => s.config.network);
  const { setNetwork } = useLab.getState();
  const sizes = [network.features.length, ...network.hidden, 1];
  const { paramCount } = buildLayout({
    inputSize: sizes[0],
    hidden: network.hidden,
    activation: network.activation,
  });
  const setLayerCount = (n: number) => {
    const hidden = network.hidden.slice(0, n);
    while (hidden.length < n) hidden.push(hidden[hidden.length - 1] ?? 4);
    setNetwork({ hidden });
  };
  return (
    <Card
      title="네트워크"
      testId="network-card"
      tour="network"
      subtitle={`${sizes.join(' – ')} · 파라미터 ${paramCount.toLocaleString()}개`}
      aside={
        <Stepper
          label="은닉층 수"
          value={network.hidden.length}
          min={0}
          max={LIMITS.maxHiddenLayers}
          onChange={setLayerCount}
        />
      }
    >
      {network.hidden.length === 0 ? (
        <p className={styles.hint}>은닉층이 없으면 직선 하나로만 나눌 수 있습니다.</p>
      ) : (
        <div>
          {network.hidden.map((n, l) => (
            <Row key={l} label={l === 0 ? <Term id="hiddenLayer">은닉 1</Term> : `은닉 ${l + 1}`}>
              <Stepper
                label={`은닉 ${l + 1} 뉴런 수`}
                value={n}
                min={1}
                max={LIMITS.maxNeurons}
                onChange={(v) => setNetwork({ hidden: network.hidden.map((x, k) => (k === l ? v : x)) })}
              />
            </Row>
          ))}
        </div>
      )}
      <span className={styles.label}>
        <Term id="activation" />
      </span>
      <Segmented<ActivationId>
        label="활성화 함수"
        stretch
        value={network.activation}
        options={ACTIVATIONS}
        onChange={(activation) => setNetwork({ activation })}
      />
    </Card>
  );
}

function ChartCard() {
  const [kind, setKind] = useState<ChartKind>('loss');
  return (
    <Card
      title="학습 곡선"
      tour="chart"
      aside={
        <Segmented<ChartKind>
          label="지표"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'loss', label: '손실' },
            { value: 'accuracy', label: '정확도' },
          ]}
        />
      }
    >
      <div className={styles.chart}>
        <MetricChart kind={kind} log={kind === 'loss'} />
      </div>
      <div className={styles.chartLegend}>
        <span>
          <i style={{ borderColor: CHART_COLORS.train }} /> 학습
        </span>
        <span>
          <i style={{ borderColor: CHART_COLORS.test, borderTopStyle: 'dashed' }} /> 검증
        </span>
        <span className={styles.chartHint}>
          <Term id="timeTravel">곡선을 눌러 과거 보기</Term>
        </span>
      </div>
    </Card>
  );
}

function AdvancedSettings() {
  const dataset = useLab((s) => s.config.dataset);
  const hyper = useLab((s) => s.config.hyper);
  const features = useLab((s) => s.config.network.features);
  const open = useLab((s) => s.advancedOpen);
  const showPulses = useLab((s) => s.showPulses);
  const setShowPulses = useLab.getState().setShowPulses;
  const { setDataset, setHyper, setNetwork, newSeed, setAdvancedOpen } = useLab.getState();
  const toggleFeature = (id: FeatureId) => {
    const has = features.includes(id);
    if (has && features.length === 1) return;
    setNetwork({
      features: FEATURES.map((f) => f.id).filter((f) => (f === id ? !has : features.includes(f))),
    });
  };
  return (
    <Disclosure title="고급 설정" open={open} onToggle={setAdvancedOpen} tour="advanced">
      <div className={styles.grid2}>
        <Field label={<Term id="learningRate" />}>
          <Select<number>
            label="학습률"
            value={hyper.learningRate}
            options={LEARNING_RATES.map((v) => ({ value: v, label: String(v) }))}
            onChange={(learningRate) => setHyper({ learningRate })}
          />
        </Field>
        <Field label={<Term id="optimizer" />}>
          <Select<OptimizerId>
            label="옵티마이저"
            value={hyper.optimizer}
            options={(['sgd', 'momentum', 'adam'] as const).map((v) => ({
              value: v,
              label: OPTIMIZER_LABELS[v],
            }))}
            onChange={(optimizer) => setHyper({ optimizer })}
          />
        </Field>
        <Field label={<Term id="batchSize" />}>
          <Select<number>
            label="배치 크기"
            value={hyper.batchSize}
            options={BATCH_SIZES.map((v) => ({ value: v, label: v === 0 ? '전체' : String(v) }))}
            onChange={(batchSize) => setHyper({ batchSize })}
          />
        </Field>
        <Field label={<Term id="l2" />}>
          <Select<number>
            label="L2 정규화"
            value={hyper.l2}
            options={[0, 0.0001, 0.001, 0.01, 0.1].map((v) => ({
              value: v,
              label: v === 0 ? '없음' : String(v),
            }))}
            onChange={(l2) => setHyper({ l2 })}
          />
        </Field>
      </div>
      <Field label="샘플 수" value={dataset.samples}>
        <Slider
          label="샘플 수"
          value={dataset.samples}
          min={LIMITS.minSamples}
          max={LIMITS.maxSamples}
          step={10}
          onChange={(samples) => setDataset({ samples })}
        />
      </Field>
      <Field label={<Term id="noise" />} value={dataset.noise.toFixed(2)}>
        <Slider
          label="노이즈"
          value={dataset.noise}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(noise) => setDataset({ noise })}
        />
      </Field>
      <Field
        label={<Term id="validation">학습 데이터 비율</Term>}
        value={`${Math.round(dataset.trainRatio * 100)}%`}
      >
        <Slider
          label="학습 데이터 비율"
          value={dataset.trainRatio}
          min={0.5}
          max={0.9}
          step={0.05}
          onChange={(trainRatio) => setDataset({ trainRatio })}
        />
      </Field>
      <Field label={<Term id="features" />}>
        <div className={styles.chips} role="group" aria-label="입력 특성">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={features.includes(f.id)}
              className={features.includes(f.id) ? styles.chipOn : styles.chip}
              onClick={() => toggleFeature(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Field>
      <label className={styles.toggle}>
        <input type="checkbox" checked={showPulses} onChange={(e) => setShowPulses(e.target.checked)} />
        신호 흐름 애니메이션
      </label>
      <button type="button" className={styles.link} onClick={newSeed}>
        새 데이터와 가중치 생성
      </button>
    </Disclosure>
  );
}

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="데이터와 네트워크 설정">
      <LessonCard />
      <DataCard />
      <NetworkCard />
      <ChartCard />
      <AdvancedSettings />
    </aside>
  );
}
