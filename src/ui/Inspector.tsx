import { featureLabel } from '@core/data/features';
import { activationFormula } from '@core/nn/activations';
import { weightIndex, type Model } from '@core/nn/model';
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

function Result({ rows }: { rows: { label: string; value: string; color?: string; testId?: string }[] }) {
  return (
    <dl className={styles.result}>
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd className="num" style={r.color ? { color: r.color } : undefined} data-testid={r.testId}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
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
    const value = trace.a[0][index];
    const outs = Array.from({ length: L.outSize }, (_, j) => {
      const w = model.params[weightIndex(L, j, index)];
      return { to: j, weight: w, contribution: w * value };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const max = Math.max(...outs.map((o) => Math.abs(o.contribution)), 1e-9);
    return (
      <>
        <Result rows={[{ label: '입력값', value: formatSigned(value), color: signColor(value) }]} />
        <table className={styles.table}>
          <thead>
            <tr>
              <th>보내는 곳</th>
              <th>w</th>
              <th>w·a</th>
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
                <td className="num">{formatSigned(o.weight)}</td>
                <td className="num">{formatSigned(o.contribution)}</td>
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
      <p className={styles.formula}>
        z = Σ w·a + b<span>{act}</span>
      </p>
      <table className={styles.table} data-testid="breakdown">
        <thead>
          <tr>
            <th>입력</th>
            <th>a</th>
            <th>w</th>
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
              <td className="num">{formatSigned(r.value)}</td>
              <td className="num">{formatSigned(r.weight)}</td>
              <td className="num">{formatSigned(r.contribution)}</td>
              <td>
                <Bar value={r.contribution} max={max} />
              </td>
            </tr>
          ))}
          {rest.length > 0 && (
            <tr className={styles.muted}>
              <td colSpan={3}>나머지 {rest.length}개</td>
              <td className="num">{formatSigned(restSum)}</td>
              <td>
                <Bar value={restSum} max={max} />
              </td>
            </tr>
          )}
          <tr className={styles.muted}>
            <td colSpan={3}>편향 b</td>
            <td className="num">{formatSigned(b.bias)}</td>
            <td>
              <Bar value={b.bias} max={max} />
            </td>
          </tr>
        </tbody>
      </table>
      <Result
        rows={[
          { label: 'z', value: formatSigned(b.z), testId: 'inspector-z' },
          {
            label: `a = ${activationFormula(act)}`,
            value: formatSigned(b.a),
            color: signColor(isOutput ? b.a - 0.5 : b.a),
            testId: 'inspector-a',
          },
          ...(isOutput
            ? [
                {
                  label: '예측',
                  value: `클래스 ${b.a >= 0.5 ? 1 : 0} · ${formatNumber((b.a >= 0.5 ? b.a : 1 - b.a) * 100, 1)}%`,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <p className={styles.hint}>학습을 진행하면 변화가 기록됩니다.</p>;
  const W = 260;
  const H = 44;
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
      <line x1={0} x2={W} y1={zero} y2={zero} stroke="#d2d2d7" strokeDasharray="3 3" />
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
  return (
    <>
      <Result
        rows={[
          { label: '가중치 w', value: formatSigned(w), color: signColor(w) },
          { label: '입력 활성화 a', value: formatSigned(a) },
          { label: '기여도 w·a', value: formatSigned(w * a), color: signColor(w * a) },
        ]}
      />
      <div>
        <h3 className={styles.subhead}>
          가중치 변화
          {h.paramEpochs.length > 1 && (
            <span className="num">
              {' '}
              · epoch {h.paramEpochs[0]}–{h.paramEpochs[h.paramEpochs.length - 1]}
            </span>
          )}
        </h3>
        <Sparkline values={h.params.map((p) => p[pi])} />
      </div>
    </>
  );
}

/** Floating card with the selected neuron's or weight's computation. Hidden when nothing is selected. */
export function Inspector() {
  useLiveTick(12);
  const selection = useLab((st) => st.selection);
  if (!selection) return null;
  const s = useLab.getState();
  const model = liveModel(s);
  const trace = liveTrace(s);
  const pt = s.probe.point;

  const title =
    selection.kind === 'neuron'
      ? neuronLabel(s, selection.layer, selection.index)
      : `${neuronLabel(s, selection.layer - 1, selection.from)} → ${neuronLabel(s, selection.layer, selection.to)}`;

  return (
    <aside className={styles.panel} aria-label="계산 인스펙터" data-testid="inspector">
      <header className={styles.header}>
        <div>
          <h2 data-testid="inspector-title">{title}</h2>
          <p className="num">
            입력 {pt ? `(${formatSigned(pt[0], 2)}, ${formatSigned(pt[1], 2)})` : '—'}
            {s.probe.auto && ' · 샘플 순회 중'}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={() => s.select(null)} aria-label="선택 해제">
          <CloseIcon width={14} height={14} />
        </button>
      </header>
      <div className={styles.body}>
        {(!model || !trace) && <p className={styles.hint}>모델을 불러오는 중…</p>}
        {selection.kind === 'neuron' && model && trace && (
          <NeuronView s={s} model={model} trace={trace} t={selection} />
        )}
        {selection.kind === 'edge' && model && trace && (
          <EdgeView s={s} model={model} trace={trace} t={selection} />
        )}
      </div>
    </aside>
  );
}
