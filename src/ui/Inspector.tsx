import { featureLabel } from '@core/data/features';
import { activationFormula } from '@core/nn/activations';
import { buildLayout, weightIndex, type Model } from '@core/nn/model';
import { neuronBreakdown, type Trace } from '@core/nn/trace';
import { liveModel, liveTrace } from '@state/derived';
import { useLab, type LabState, type Target } from '@state/store';
import { CSS_COLORS, formatNumber, formatSigned } from '@viz/encoding';
import { layerName } from '@viz/three/sceneRefs';
import { useLiveTick } from './hooks';
import { CloseIcon } from './icons';
import styles from './Inspector.module.css';

const TOP_TERMS = 8;

const signColor = (v: number) => (v >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative);

function neuronLabel(s: LabState, layer: number, index: number): string {
  const count = s.config.network.hidden.length + 2;
  if (layer === 0) return featureLabel(s.config.network.features[index]);
  if (layer === count - 1) return '출력';
  return `${layerName(layer, count)} · N${index + 1}`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <span className={styles.bar}>
      <span style={{ width: `${w}%`, background: signColor(value) }} />
    </span>
  );
}

function ProbeHeader({ s }: { s: LabState }) {
  const pt = s.probe.point;
  return (
    <div className={styles.probe}>
      입력{' '}
      <span className="mono">
        {pt ? `(x₁, x₂) = (${formatSigned(pt[0], 2)}, ${formatSigned(pt[1], 2)})` : '—'}
      </span>
      {s.probe.auto && <span className={styles.auto}>샘플 순회</span>}
    </div>
  );
}

function NeuronView({
  s,
  model,
  trace,
  t,
}: {
  s: LabState;
  model: Model;
  trace: Trace;
  t: Target & { kind: 'neuron' };
}) {
  const { layer, index } = t;
  const last = model.sizes.length - 1;
  const setHover = useLab.getState().setHover;

  if (layer === 0) {
    // Input neuron: show its value and where it sends signal.
    const L = model.layers[0];
    const outs = Array.from({ length: L.outSize }, (_, j) => {
      const w = model.params[weightIndex(L, j, index)];
      return { to: j, weight: w, contribution: w * trace.a[0][index] };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const max = Math.max(...outs.map((o) => Math.abs(o.contribution)), 1e-9);
    return (
      <>
        <div className={styles.formula}>
          <span>{featureLabel(s.config.network.features[index])}</span> ={' '}
          <b className="mono" style={{ color: signColor(trace.a[0][index]) }}>
            {formatSigned(trace.a[0][index])}
          </b>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>보내는 곳</th>
              <th>가중치</th>
              <th>기여도</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {outs.map((o) => (
              <tr
                key={o.to}
                onMouseEnter={() => setHover({ kind: 'edge', layer: 1, from: index, to: o.to })}
                onMouseLeave={() => setHover(null)}
              >
                <td>{neuronLabel(s, 1, o.to)}</td>
                <td className="mono">{formatSigned(o.weight)}</td>
                <td className="mono">{formatSigned(o.contribution)}</td>
                <td>
                  <Bar value={o.contribution} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  const b = neuronBreakdown(model, trace, layer, index);
  const terms = [...b.inputs].sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
  const shown = terms.slice(0, TOP_TERMS);
  const rest = terms.slice(TOP_TERMS);
  const restSum = rest.reduce((acc, r) => acc + r.contribution, 0);
  const max = Math.max(...terms.map((r) => Math.abs(r.contribution)), Math.abs(b.bias), 1e-9);
  const act = model.layers[layer - 1].activation;
  const isOutput = layer === last;

  return (
    <>
      <div className={styles.formula}>
        z = Σ wᵢ·aᵢ + b <span className={styles.dim}>· {act}</span>
      </div>
      <table className={styles.table} data-testid="breakdown">
        <thead>
          <tr>
            <th>입력</th>
            <th>값 a</th>
            <th>가중치 w</th>
            <th>w·a</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.from}
              onMouseEnter={() => setHover({ kind: 'edge', layer, from: r.from, to: index })}
              onMouseLeave={() => setHover(null)}
            >
              <td>{neuronLabel(s, layer - 1, r.from)}</td>
              <td className="mono">{formatSigned(r.value)}</td>
              <td className="mono">{formatSigned(r.weight)}</td>
              <td className="mono">{formatSigned(r.contribution)}</td>
              <td>
                <Bar value={r.contribution} max={max} />
              </td>
            </tr>
          ))}
          {rest.length > 0 && (
            <tr className={styles.rest}>
              <td colSpan={3}>나머지 {rest.length}개 합계</td>
              <td className="mono">{formatSigned(restSum)}</td>
              <td>
                <Bar value={restSum} max={max} />
              </td>
            </tr>
          )}
          <tr className={styles.biasRow}>
            <td colSpan={3}>편향 b</td>
            <td className="mono">{formatSigned(b.bias)}</td>
            <td>
              <Bar value={b.bias} max={max} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className={styles.result}>
        <div>
          <span>z</span>
          <b className="mono" data-testid="inspector-z">
            {formatSigned(b.z)}
          </b>
        </div>
        <div>
          <span>a = {activationFormula(act)}</span>
          <b
            className="mono"
            style={{ color: signColor(isOutput ? b.a - 0.5 : b.a) }}
            data-testid="inspector-a"
          >
            {formatSigned(b.a)}
          </b>
        </div>
        {isOutput && (
          <div>
            <span>예측</span>
            <b>
              클래스 {b.a >= 0.5 ? 1 : 0}{' '}
              <span className={styles.dim}>
                ({formatNumber((b.a >= 0.5 ? b.a : 1 - b.a) * 100, 1)}% 확신)
              </span>
            </b>
          </div>
        )}
      </div>
    </>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className={styles.sparkEmpty}>학습을 진행하면 변화가 기록됩니다.</div>;
  const W = 260;
  const H = 48;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, k) => `${(k / (values.length - 1)) * W},${H - ((v - min) / span) * H}`)
    .join(' ');
  const zero = H - ((0 - min) / span) * H;
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-label="가중치 변화"
    >
      <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--border-strong)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={signColor(values[values.length - 1])} strokeWidth={1.5} />
    </svg>
  );
}

function EdgeView({
  s,
  model,
  trace,
  t,
}: {
  s: LabState;
  model: Model;
  trace: Trace;
  t: Target & { kind: 'edge' };
}) {
  const L = model.layers[t.layer - 1];
  const pi = weightIndex(L, t.to, t.from);
  const w = model.params[pi];
  const a = trace.a[t.layer - 1][t.from];
  const h = s.history;
  const history = h.params.map((p) => p[pi]);
  const first = h.paramEpochs[0];
  return (
    <>
      <div className={styles.edgePath}>
        <span>{neuronLabel(s, t.layer - 1, t.from)}</span>
        <span className={styles.arrow}>→</span>
        <span>{neuronLabel(s, t.layer, t.to)}</span>
      </div>
      <div className={styles.result}>
        <div>
          <span>가중치 w</span>
          <b className="mono" style={{ color: signColor(w) }}>
            {formatSigned(w)}
          </b>
        </div>
        <div>
          <span>입력 활성화 a</span>
          <b className="mono">{formatSigned(a)}</b>
        </div>
        <div>
          <span>기여도 w·a</span>
          <b className="mono" style={{ color: signColor(w * a) }}>
            {formatSigned(w * a)}
          </b>
        </div>
      </div>
      <h3 className={styles.subhead}>
        가중치 변화{' '}
        {h.paramEpochs.length > 1 && (
          <span className={styles.dim}>
            epoch {first} → {h.paramEpochs[h.paramEpochs.length - 1]}
          </span>
        )}
      </h3>
      <Sparkline values={history} />
    </>
  );
}

function Summary({ s }: { s: LabState }) {
  const sizes = [s.config.network.features.length, ...s.config.network.hidden, 1];
  const { paramCount } = buildLayout({
    inputSize: sizes[0],
    hidden: s.config.network.hidden,
    activation: s.config.network.activation,
  });
  return (
    <>
      <p className={styles.hint}>3D 뷰에서 뉴런이나 연결을 클릭하면 계산 과정을 보여 줍니다.</p>
      <div className={styles.result}>
        <div>
          <span>구조</span>
          <b className="mono">{sizes.join(' – ')}</b>
        </div>
        <div>
          <span>파라미터</span>
          <b className="mono">{paramCount.toLocaleString()}</b>
        </div>
        <div>
          <span>활성화 함수</span>
          <b className="mono">{s.config.network.activation}</b>
        </div>
        <div>
          <span>손실 함수</span>
          <b className="mono">binary cross-entropy</b>
        </div>
      </div>
      <h3 className={styles.subhead}>단축키</h3>
      <ul className={styles.keys}>
        <li>
          <kbd>Space</kbd> 학습 / 일시정지
        </li>
        <li>
          <kbd>.</kbd> 1 에폭 진행 · <kbd>R</kbd> 초기화
        </li>
        <li>
          <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 정면 · 측면 · 등각 보기
        </li>
        <li>
          <kbd>Esc</kbd> 선택 해제 · 더블클릭 포커스
        </li>
      </ul>
    </>
  );
}

export function Inspector() {
  useLiveTick(12);
  const selection = useLab((st) => st.selection);
  const s = useLab.getState();
  const model = liveModel(s);
  const trace = liveTrace(s);

  let title = '모델 요약';
  if (selection?.kind === 'neuron') title = neuronLabel(s, selection.layer, selection.index);
  if (selection?.kind === 'edge') title = '연결';

  return (
    <aside className={styles.panel} aria-label="계산 인스펙터" data-testid="inspector">
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>
            {selection ? (selection.kind === 'neuron' ? '뉴런' : '가중치') : 'Inspector'}
          </div>
          <h2 data-testid="inspector-title">{title}</h2>
        </div>
        {selection && (
          <button
            type="button"
            className={styles.close}
            onClick={() => s.select(null)}
            aria-label="선택 해제"
          >
            <CloseIcon />
          </button>
        )}
      </header>
      <div className={styles.body}>
        {selection && <ProbeHeader s={s} />}
        {!selection && <Summary s={s} />}
        {selection && (!model || !trace) && <p className={styles.hint}>모델을 불러오는 중…</p>}
        {selection?.kind === 'neuron' && model && trace && (
          <NeuronView s={s} model={model} trace={trace} t={selection} />
        )}
        {selection?.kind === 'edge' && model && trace && (
          <EdgeView s={s} model={model} trace={trace} t={selection} />
        )}
      </div>
    </aside>
  );
}
