import { DATASETS, type DatasetId } from '@core/data/datasets';
import { FEATURES, type FeatureId } from '@core/data/features';
import { ACTIVATIONS, type ActivationId } from '@core/nn/activations';
import type { OptimizerId } from '@core/nn/optimizers';
import { LIMITS } from '@core/train/config';
import { useLab } from '@state/store';
import { DecisionBoundary } from '@viz/canvas2d/DecisionBoundary';
import { CSS_COLORS } from '@viz/encoding';
import { Field, Section, Select, Slider, Stepper } from './controls';
import styles from './LeftPanel.module.css';

const LEARNING_RATES = [0.0001, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
const BATCH_SIZES = [1, 4, 10, 30, 0];
const OPTIMIZER_LABELS: Record<OptimizerId, string> = { sgd: 'SGD', momentum: 'Momentum', adam: 'Adam' };
const ACTIVATION_LABELS: Record<ActivationId, string> = {
  tanh: 'tanh',
  relu: 'ReLU',
  sigmoid: 'Sigmoid',
  linear: 'Linear',
};

function DataSection() {
  const dataset = useLab((s) => s.config.dataset);
  const probe = useLab((s) => s.probe);
  const { setDataset, setProbeAuto } = useLab.getState();
  return (
    <Section title="데이터">
      <DecisionBoundary size={286} />
      <div className={styles.legendRow}>
        <span>
          <i style={{ background: CSS_COLORS.positive }} /> 클래스 1
        </span>
        <span>
          <i style={{ background: CSS_COLORS.negative }} /> 클래스 0
        </span>
        <span>
          <i className={styles.hollow} /> 검증
        </span>
      </div>
      <div className={styles.probe}>
        <span>
          프로브{' '}
          <span className="mono">
            {probe.point ? `(${probe.point[0].toFixed(2)}, ${probe.point[1].toFixed(2)})` : '—'}
          </span>
        </span>
        {probe.auto ? (
          <span className={styles.auto}>샘플 순회 중</span>
        ) : (
          <button type="button" className={styles.link} onClick={() => setProbeAuto(true)}>
            샘플 순회
          </button>
        )}
      </div>
      <Field label="데이터셋">
        <Select<DatasetId>
          label="데이터셋"
          value={dataset.id}
          options={DATASETS.map((d) => ({ value: d.id, label: d.label }))}
          onChange={(id) => setDataset({ id })}
        />
      </Field>
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
      <Field label="노이즈" value={dataset.noise.toFixed(2)}>
        <Slider
          label="노이즈"
          value={dataset.noise}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(noise) => setDataset({ noise })}
        />
      </Field>
      <Field label="학습 데이터 비율" value={`${Math.round(dataset.trainRatio * 100)}%`}>
        <Slider
          label="학습 데이터 비율"
          value={dataset.trainRatio}
          min={0.5}
          max={0.9}
          step={0.05}
          onChange={(trainRatio) => setDataset({ trainRatio })}
        />
      </Field>
    </Section>
  );
}

function NetworkSection() {
  const network = useLab((s) => s.config.network);
  const { setNetwork } = useLab.getState();
  const toggleFeature = (id: FeatureId) => {
    const has = network.features.includes(id);
    if (has && network.features.length === 1) return;
    const features = FEATURES.map((f) => f.id).filter((f) =>
      f === id ? !has : network.features.includes(f),
    );
    setNetwork({ features });
  };
  const setLayerCount = (n: number) => {
    const hidden = network.hidden.slice(0, n);
    while (hidden.length < n) hidden.push(hidden[hidden.length - 1] ?? 4);
    setNetwork({ hidden });
  };
  return (
    <Section
      title="네트워크"
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
      <div className={styles.layers}>
        {network.hidden.length === 0 && (
          <p className={styles.hint}>은닉층 없음 — 로지스틱 회귀와 같습니다.</p>
        )}
        {network.hidden.map((n, l) => (
          <div key={l} className={styles.layerRow}>
            <span>은닉 {l + 1}</span>
            <Stepper
              label={`은닉 ${l + 1} 뉴런 수`}
              value={n}
              min={1}
              max={LIMITS.maxNeurons}
              onChange={(v) => setNetwork({ hidden: network.hidden.map((x, k) => (k === l ? v : x)) })}
            />
          </div>
        ))}
      </div>
      <Field label="활성화 함수">
        <Select<ActivationId>
          label="활성화 함수"
          value={network.activation}
          options={ACTIVATIONS.map((a) => ({ value: a, label: ACTIVATION_LABELS[a] }))}
          onChange={(activation) => setNetwork({ activation })}
        />
      </Field>
      <Field label="입력 특성">
        <div className={styles.chips} role="group" aria-label="입력 특성">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={network.features.includes(f.id)}
              className={network.features.includes(f.id) ? styles.chipOn : styles.chip}
              onClick={() => toggleFeature(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Field>
    </Section>
  );
}

function TrainingSection() {
  const hyper = useLab((s) => s.config.hyper);
  const { setHyper } = useLab.getState();
  return (
    <Section title="학습">
      <div className={styles.grid2}>
        <Field label="학습률">
          <Select<number>
            label="학습률"
            value={hyper.learningRate}
            options={LEARNING_RATES.map((v) => ({ value: v, label: String(v) }))}
            onChange={(learningRate) => setHyper({ learningRate })}
          />
        </Field>
        <Field label="옵티마이저">
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
        <Field label="배치 크기">
          <Select<number>
            label="배치 크기"
            value={hyper.batchSize}
            options={BATCH_SIZES.map((v) => ({ value: v, label: v === 0 ? '전체' : String(v) }))}
            onChange={(batchSize) => setHyper({ batchSize })}
          />
        </Field>
        <Field label="L2 정규화">
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
    </Section>
  );
}

export function LeftPanel() {
  return (
    <aside className={styles.panel} aria-label="데이터와 네트워크 설정">
      <DataSection />
      <NetworkSection />
      <TrainingSection />
    </aside>
  );
}
