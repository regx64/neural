import { useState } from 'react';
import { Segmented } from '@ui/controls';
import styles from './Learn.module.css';

/** Loss as a function of a single weight: a valley with its lowest point at w = 1.5. */
const loss = (w: number) => 0.5 * (w - 1.5) ** 2;
const grad = (w: number) => w - 1.5;
const START = -2.6;
const W_MIN = -3.2;
const W_MAX = 6.2;
const L_MAX = 12;

const RATES = {
  small: { lr: 0.08, label: '작게' },
  good: { lr: 0.6, label: '알맞게' },
  big: { lr: 2.05, label: '너무 크게' },
} as const;
type Rate = keyof typeof RATES;

const SVG_W = 560;
const SVG_H = 240;
const PAD = 24;
const x = (w: number) => PAD + ((w - W_MIN) / (W_MAX - W_MIN)) * (SVG_W - 2 * PAD);
const PAD_BOTTOM = 40;
const y = (l: number) => SVG_H - PAD_BOTTOM - (Math.min(l, L_MAX) / L_MAX) * (SVG_H - PAD - PAD_BOTTOM);

/**
 * Gradient descent in one dimension: the ball is a weight, its height the loss. Each step moves
 * it downhill by learning rate × slope, so the step size choice is visible at a glance.
 */
export function LossValley() {
  const [rate, setRate] = useState<Rate>('good');
  const [path, setPath] = useState<number[]>([START]);
  const w = path[path.length - 1];
  const escaped = Math.abs(w) > 12;

  const step = (n: number) => {
    const next = [...path];
    for (let k = 0; k < n; k++) {
      const cur = next[next.length - 1];
      if (Math.abs(cur) > 12) break;
      next.push(cur - RATES[rate].lr * grad(cur));
    }
    setPath(next);
  };

  const curve = Array.from({ length: 120 }, (_, k) => {
    const ww = W_MIN + ((W_MAX - W_MIN) * k) / 119;
    return `${k ? 'L' : 'M'}${x(ww).toFixed(1)},${y(loss(ww)).toFixed(1)}`;
  }).join(' ');
  const visible = path.filter((p) => p >= W_MIN && p <= W_MAX);

  return (
    <div className={styles.valley} data-testid="loss-valley">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={styles.valleySvg} aria-label="손실 골짜기와 공">
        <path d={curve} fill="none" stroke="#d2d2d7" strokeWidth={3} strokeLinecap="round" />
        <text x={x(1.5)} y={SVG_H - 12} textAnchor="middle" className={styles.valleyLabel}>
          가장 낮은 곳
        </text>
        {visible.slice(1).map((p, k) => (
          <line
            key={k}
            x1={x(visible[k])}
            y1={y(loss(visible[k]))}
            x2={x(p)}
            y2={y(loss(p))}
            stroke="#0071e3"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        ))}
        {visible.map((p, k) => (
          <circle key={k} cx={x(p)} cy={y(loss(p))} r={3} fill="#0071e3" fillOpacity={0.25} />
        ))}
        {!escaped && w >= W_MIN && w <= W_MAX && (
          <circle cx={x(w)} cy={y(loss(w)) - 9} r={9} fill="#0071e3" stroke="#fff" strokeWidth={2} />
        )}
      </svg>
      <div className={styles.valleyBar}>
        <Segmented<Rate>
          label="학습률"
          value={rate}
          onChange={(r) => {
            setRate(r);
            setPath([START]);
          }}
          options={(Object.keys(RATES) as Rate[]).map((r) => ({
            value: r,
            label: `${RATES[r].label} (${RATES[r].lr})`,
          }))}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => step(1)} disabled={escaped}>
            한 걸음
          </button>
          <button type="button" className={styles.secondary} onClick={() => step(10)} disabled={escaped}>
            열 걸음
          </button>
          <button type="button" className={styles.textButton} onClick={() => setPath([START])}>
            처음으로
          </button>
        </div>
      </div>
      <p className={styles.valleyStatus} aria-live="polite">
        {escaped || w < W_MIN || w > W_MAX
          ? '공이 골짜기 밖으로 튕겨 나갔어요! 보폭이 너무 크면 손실이 오히려 커져요.'
          : path.length === 1
            ? '공의 위치가 가중치, 높이가 손실이에요. "한 걸음"을 눌러 보세요.'
            : Math.abs(grad(w)) < 0.02
              ? `${path.length - 1}걸음 만에 바닥에 도착했어요. 손실 ${loss(w).toFixed(3)}`
              : `${path.length - 1}걸음째 · 손실 ${loss(w).toFixed(3)}`}
      </p>
    </div>
  );
}
