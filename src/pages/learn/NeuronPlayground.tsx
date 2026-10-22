import { useEffect, useMemo, useRef, useState } from 'react';
import { generateDataset, toSamples } from '@core/data/datasets';
import { predictGrid } from '@core/nn/grid';
import { batchGradients, createModel, createWorkspace, evaluate } from '@core/nn/model';
import { boundaryRGBA, CSS_COLORS, formatSigned } from '@viz/encoding';
import { isoLines } from '@viz/contour';
import { Slider } from '@ui/controls';
import { CheckIcon } from '@ui/icons';
import { Term } from '@ui/Term';
import styles from './Learn.module.css';

const SPEC = { inputSize: 2, hidden: [], activation: 'tanh' as const };
const START: [number, number, number] = [-1.6, 0.4, 0.6];
const LEARNING_RATE = 1.5;
const RES = 48;
const RANGE = { w: 6, b: 4 };

const clamp = (v: number, r: number) => Math.max(-r, Math.min(r, v));

/**
 * A single neuron (logistic regression) the learner tunes by hand with three sliders, then
 * watches gradient descent tune for them. Its parameters are [w₁, w₂, b] in the engine layout.
 */
export function NeuronPlayground() {
  const data = useMemo(() => {
    const d = generateDataset({ id: 'gaussian', samples: 60, noise: 0.02, trainRatio: 0.9 }, 3);
    const all = Uint32Array.from({ length: d.count }, (_, i) => i);
    return { d, samples: toSamples(d, all, ['x1', 'x2']), all };
  }, []);
  const [params, setParams] = useState<[number, number, number]>(START);
  const [delta, setDelta] = useState<[number, number, number] | null>(null);
  const [auto, setAuto] = useState(false);
  const [missions, setMissions] = useState({ moved: false, perfect: false, learned: false });
  const canvas = useRef<HTMLCanvasElement>(null);

  const model = useMemo(() => createModel(SPEC, Float64Array.from(params)), [params]);
  const { loss, accuracy } = useMemo(
    () => evaluate(model, createWorkspace(model), data.samples),
    [model, data],
  );

  /** Sets new parameters and records whether the "100%" mission has been reached. */
  const apply = (next: [number, number, number], d: [number, number, number] | null, learned: boolean) => {
    const m = createModel(SPEC, Float64Array.from(next));
    const perfect = evaluate(m, createWorkspace(m), data.samples).accuracy >= 1;
    setParams(next);
    setDelta(d);
    setMissions((ms) => ({
      moved: ms.moved || !learned,
      perfect: ms.perfect || perfect,
      learned: ms.learned || learned,
    }));
    return perfect && evaluate(m, createWorkspace(m), data.samples).loss < 0.15;
  };

  /** One full-batch gradient-descent step; returns whether the problem is now clearly solved. */
  const step = () => {
    const grads = new Float64Array(3);
    batchGradients(model, createWorkspace(model), data.samples, data.all, 0, data.all.length, grads);
    const next: [number, number, number] = [
      clamp(params[0] - LEARNING_RATE * grads[0], RANGE.w),
      clamp(params[1] - LEARNING_RATE * grads[1], RANGE.w),
      clamp(params[2] - LEARNING_RATE * grads[2], RANGE.b),
    ];
    return apply(next, [next[0] - params[0], next[1] - params[1], next[2] - params[2]], true);
  };

  // "Learn automatically": one gradient step every 60ms until it is clearly solved.
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => {
      if (step()) setAuto(false);
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, params]);

  // Plot: prediction shading, boundary line (z = 0), data points.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth;
    c.width = c.height = Math.round(W * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grid = predictGrid(model, ['x1', 'x2'], RES);
    const img = document.createElement('canvas');
    img.width = img.height = RES;
    const ictx = img.getContext('2d')!;
    const id = ictx.createImageData(RES, RES);
    for (let k = 0; k < RES * RES; k++) boundaryRGBA(grid[k], id.data, k * 4);
    ictx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, W, W);
    const segs = isoLines(grid, RES, 0.5);
    ctx.strokeStyle = CSS_COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < segs.length; k += 4) {
      ctx.moveTo((segs[k] * W) / RES, (segs[k + 1] * W) / RES);
      ctx.lineTo((segs[k + 2] * W) / RES, (segs[k + 3] * W) / RES);
    }
    ctx.stroke();
    const { d } = data;
    for (let s = 0; s < d.count; s++) {
      ctx.beginPath();
      ctx.arc(((d.points[2 * s] + 1) / 2) * W, ((1 - d.points[2 * s + 1]) / 2) * W, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = d.labels[s] ? CSS_COLORS.positive : CSS_COLORS.negative;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [model, data]);

  const set = (k: 0 | 1 | 2, v: number) => {
    const next = [...params] as [number, number, number];
    next[k] = v;
    apply(next, null, false);
  };

  const sliders = [
    { k: 0 as const, label: 'w₁', hint: 'x₁(가로)을 얼마나 중요하게 볼지', range: RANGE.w },
    { k: 1 as const, label: 'w₂', hint: 'x₂(세로)를 얼마나 중요하게 볼지', range: RANGE.w },
    { k: 2 as const, label: 'b', hint: '선을 앞뒤로 미는 기준점', range: RANGE.b },
  ];

  return (
    <div className={styles.widget} data-testid="neuron-playground">
      <div className={styles.widgetPlot}>
        <canvas ref={canvas} className={styles.plot} aria-label="뉴런 하나의 결정 경계" />
        <div className={styles.score}>
          <div>
            <span>
              <Term id="accuracy" />
            </span>
            <b
              className="num"
              data-testid="playground-accuracy"
              style={{ color: accuracy >= 1 ? '#1a7f37' : undefined }}
            >
              {(accuracy * 100).toFixed(0)}%
            </b>
          </div>
          <div>
            <span>
              <Term id="loss" />
            </span>
            <b className="num">{loss.toFixed(3)}</b>
          </div>
        </div>
      </div>
      <div className={styles.widgetControls}>
        <NeuronDiagram w1={params[0]} w2={params[1]} b={params[2]} />
        {sliders.map((sl) => (
          <div key={sl.k} className={styles.param}>
            <div className={styles.paramHead}>
              <span>
                <b>{sl.label}</b> <span className={styles.paramHint}>{sl.hint}</span>
              </span>
              <span className="num">
                {formatSigned(params[sl.k], 2)}
                {delta && Math.abs(delta[sl.k]) > 0.005 && (
                  <span className={styles.delta}>
                    {delta[sl.k] > 0 ? '▲' : '▼'} {Math.abs(delta[sl.k]).toFixed(2)}
                  </span>
                )}
              </span>
            </div>
            <Slider
              label={sl.label}
              value={params[sl.k]}
              min={-sl.range}
              max={sl.range}
              step={0.01}
              onChange={(v) => set(sl.k, v)}
            />
          </div>
        ))}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => step()} disabled={auto}>
            한 걸음 배우기
          </button>
          <button type="button" className={styles.secondary} onClick={() => setAuto(!auto)}>
            {auto ? '멈추기' : '자동으로 배우기'}
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setAuto(false);
              setDelta(null);
              setParams(START);
            }}
          >
            처음으로
          </button>
        </div>
        <ul className={styles.missions} aria-label="미션">
          {[
            { done: missions.moved, text: '슬라이더를 움직여 선이 어떻게 바뀌는지 보세요' },
            { done: missions.perfect, text: '정확도 100%를 만들어 보세요' },
            { done: missions.learned, text: '"한 걸음 배우기"로 컴퓨터가 고치는 방향을 보세요' },
          ].map((m) => (
            <li key={m.text} className={m.done ? styles.missionDone : undefined}>
              <span className={styles.missionCheck}>{m.done && <CheckIcon width={10} height={10} />}</span>
              {m.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** x₁, x₂ → Σ → output, with edges drawn from the live weights. */
function NeuronDiagram({ w1, w2, b }: { w1: number; w2: number; b: number }) {
  const edge = (w: number) => ({
    stroke: w >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative,
    strokeWidth: 1 + Math.min(1, Math.abs(w) / RANGE.w) * 6,
    strokeOpacity: 0.25 + Math.min(1, Math.abs(w) / RANGE.w) * 0.75,
  });
  return (
    <svg viewBox="0 0 300 96" className={styles.diagram} aria-label="뉴런 하나의 구조">
      <line x1={40} y1={22} x2={160} y2={48} {...edge(w1)} />
      <line x1={40} y1={74} x2={160} y2={48} {...edge(w2)} />
      <line x1={160} y1={48} x2={256} y2={48} stroke="#d2d2d7" strokeWidth={2} />
      <circle cx={40} cy={22} r={15} fill="#fff" stroke="#d2d2d7" />
      <circle cx={40} cy={74} r={15} fill="#fff" stroke="#d2d2d7" />
      <circle
        cx={160}
        cy={48}
        r={22}
        fill="#fff"
        stroke={b >= 0 ? CSS_COLORS.positive : CSS_COLORS.negative}
        strokeWidth={1 + Math.min(1, Math.abs(b) / RANGE.b) * 3}
      />
      <text x={40} y={26} textAnchor="middle">
        x₁
      </text>
      <text x={40} y={78} textAnchor="middle">
        x₂
      </text>
      <text x={160} y={53} textAnchor="middle" fontWeight={600}>
        Σ
      </text>
      <text x={100} y={22} textAnchor="middle" className={styles.diagramW}>
        w₁
      </text>
      <text x={100} y={86} textAnchor="middle" className={styles.diagramW}>
        w₂
      </text>
      <text x={268} y={52} textAnchor="start">
        예측
      </text>
    </svg>
  );
}
