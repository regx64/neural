import { activateDerivative } from '@core/nn/activations';
import { weightIndex, type Model } from '@core/nn/model';
import { backwardTrace, type Trace } from '@core/nn/trace';
import type { LabState, Target } from '@state/store';
import { CSS_COLORS, formatNumber, formatSigned } from '@viz/encoding';
import { Segmented } from './controls';
import { Term } from './Term';
import styles from './Inspector.module.css';

const TOP = 8;
const signColor = (v: number) => (v >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative);

/**
 * The label backprop should aim for: the cycled sample's own label, or for a clicked point the
 * label of the nearest example (what the data says that area should be).
 */
export function probeLabel(s: LabState): 0 | 1 {
  const { dataset, probe } = s;
  if (dataset.count === 0 || !probe.point) return 1;
  if (probe.auto && dataset.train.length > 0) {
    return dataset.labels[dataset.train[probe.sampleIndex % dataset.train.length]] as 0 | 1;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < dataset.count; i++) {
    const d = Math.hypot(dataset.points[2 * i] - probe.point[0], dataset.points[2 * i + 1] - probe.point[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return dataset.labels[best] as 0 | 1;
}

function TargetPicker({ y, onChange }: { y: 0 | 1; onChange: (y: 0 | 1) => void }) {
  return (
    <div className={styles.targetRow}>
      <span>이 점의 정답</span>
      <Segmented<'1' | '0'>
        label="정답 클래스"
        value={y === 1 ? '1' : '0'}
        onChange={(v) => onChange(v === '1' ? 1 : 0)}
        options={[
          { value: '1', label: '파랑 (1)' },
          { value: '0', label: '주황 (0)' },
        ]}
      />
    </div>
  );
}

interface Props {
  s: LabState;
  model: Model;
  trace: Trace;
  t: Target;
  y: 0 | 1;
  onTarget: (y: 0 | 1) => void;
  name: (layer: number, index: number) => string;
}

/** Backpropagation for the probe input: δ = ∂L/∂z, how it was assembled, and the weight updates. */
export function BackpropView({ s, model, trace, t, y, onTarget, name }: Props) {
  const delta = backwardTrace(model, trace, y);
  const last = model.sizes.length - 1;
  const lr = s.config.hyper.learningRate;

  if (t.kind === 'edge') {
    const d = delta[t.layer][t.to];
    const a = trace.a[t.layer - 1][t.from];
    const g = d * a;
    return (
      <>
        <TargetPicker y={y} onChange={onTarget} />
        <p className={styles.plain}>
          이 점 하나만 보면, 손실을 줄이려면 이 가중치를{' '}
          <b style={{ color: signColor(-g) }}>
            {Math.abs(g) < 1e-4 ? '거의 바꿀 필요가 없어요' : -g > 0 ? '키워야 해요' : '줄여야 해요'}
          </b>
          .
        </p>
        <dl className={styles.result}>
          <div>
            <dt>도착 뉴런의 δ = ∂L/∂z</dt>
            <dd className="num">{formatSigned(d, 4)}</dd>
          </div>
          <div>
            <dt>× 출발 뉴런의 a</dt>
            <dd className="num">{formatSigned(a)}</dd>
          </div>
          <div>
            <dt>= ∂L/∂w</dt>
            <dd className="num" style={{ color: signColor(g) }} data-testid="backprop-grad">
              {formatSigned(g, 4)}
            </dd>
          </div>
          <div>
            <dt>SGD 한 걸음 Δw = −η·∂L/∂w</dt>
            <dd className="num">{formatSigned(-lr * g, 4)}</dd>
          </div>
        </dl>
      </>
    );
  }

  const { layer, index } = t;
  if (layer === 0) {
    return <p className={styles.hint}>입력 뉴런에는 가중치가 없어서 역전파로 고칠 것이 없어요.</p>;
  }
  const d = delta[layer][index];
  const z = trace.z[layer][index];
  const a = trace.a[layer][index];
  const act = model.layers[layer - 1].activation;
  const incoming = Array.from({ length: model.sizes[layer - 1] }, (_, i) => ({
    from: i,
    a: trace.a[layer - 1][i],
    g: d * trace.a[layer - 1][i],
  })).sort((p, q) => Math.abs(q.g) - Math.abs(p.g));

  return (
    <>
      <TargetPicker y={y} onChange={onTarget} />
      <p className={styles.plain}>
        {layer === last ? (
          <>
            예측은 {formatNumber(trace.output * 100, 0)}%, 정답은 {y}이에요. 손실을 줄이려면 출력이{' '}
            <b style={{ color: signColor(-d) }}>{d < 0 ? '더 커져야' : '더 작아져야'}</b> 해요.
          </>
        ) : Math.abs(d) < 1e-4 ? (
          <>이 점에 대해서는 이 뉴런을 거의 고칠 필요가 없어요.</>
        ) : (
          <>
            이 점을 더 잘 맞히려면 이 뉴런의 z가{' '}
            <b style={{ color: signColor(-d) }}>{d < 0 ? '커져야' : '작아져야'}</b> 해요.
          </>
        )}
      </p>

      {layer === last ? (
        <p className={styles.formula}>
          <span className="num">
            δ = p − y = {formatNumber(trace.output)} − {y} = {formatSigned(d)}
          </span>
        </p>
      ) : (
        <>
          <p className={styles.formula}>
            <span>δ = f′(z) · Σ w·δ(다음 층)</span>
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>다음 층</th>
                <th>w</th>
                <th>δ</th>
                <th>w·δ</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: model.sizes[layer + 1] }, (_, k) => {
                const w = model.params[weightIndex(model.layers[layer], k, index)];
                return (
                  <tr key={k}>
                    <td>{name(layer + 1, k)}</td>
                    <td className="num">{formatSigned(w)}</td>
                    <td className="num">{formatSigned(delta[layer + 1][k], 4)}</td>
                    <td className="num">{formatSigned(w * delta[layer + 1][k], 4)}</td>
                  </tr>
                );
              }).slice(0, TOP)}
            </tbody>
          </table>
        </>
      )}

      <dl className={styles.result}>
        {layer !== last && (
          <div>
            <dt>f′(z) ({act})</dt>
            <dd className="num">{formatNumber(activateDerivative(act, z, a), 4)}</dd>
          </div>
        )}
        <div>
          <dt>
            <Term id="gradient">δ = ∂L/∂z</Term>
          </dt>
          <dd className="num" style={{ color: signColor(-d) }} data-testid="backprop-delta">
            {formatSigned(d, 4)}
          </dd>
        </div>
      </dl>

      <div>
        <h3 className={styles.subhead}>
          들어오는 가중치의 기울기 <span>∂L/∂w = δ·a · SGD 학습률 {lr}</span>
        </h3>
        <table className={styles.table} data-testid="backprop-table">
          <thead>
            <tr>
              <th>입력</th>
              <th>a</th>
              <th>∂L/∂w</th>
              <th>Δw</th>
            </tr>
          </thead>
          <tbody>
            {incoming.slice(0, TOP).map((r) => (
              <tr key={r.from}>
                <td>{name(layer - 1, r.from)}</td>
                <td className="num">{formatSigned(r.a)}</td>
                <td className="num">{formatSigned(r.g, 4)}</td>
                <td className="num" style={{ color: signColor(-r.g) }}>
                  {formatSigned(-lr * r.g, 4)}
                </td>
              </tr>
            ))}
            <tr className={styles.muted}>
              <td colSpan={2}>편향 b</td>
              <td className="num">{formatSigned(d, 4)}</td>
              <td className="num">{formatSigned(-lr * d, 4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        <Term id="backprop" />: 실제 학습은 이런 기울기를 여러 점에 대해 평균 내서 한 번에 고쳐요.
        옵티마이저가 Adam이면 보폭이 자동으로 조절돼 Δw가 이 값과 달라요.
      </p>
    </>
  );
}
