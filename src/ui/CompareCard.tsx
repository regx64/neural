import { describeChanges } from '../content/diff';
import { useLab } from '@state/store';
import { BoundaryThumb } from '@viz/canvas2d/BoundaryThumb';
import { Card } from './controls';
import { useLiveTick } from './hooks';
import styles from './CompareCard.module.css';

const THUMB = 112;
const pct = (v: number | undefined) =>
  v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;
const num = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(3));

/** Side-by-side: the pinned experiment "A" against the current one. */
export function CompareCard() {
  useLiveTick(4);
  const a = useLab((s) => s.compareA);
  if (!a) return null;
  const s = useLab.getState();
  const now = s.lastLive;
  const changes = describeChanges(a.config, s.config);
  const rows: { label: string; a: string; b: string; better?: 'a' | 'b' }[] = [];
  const cmp = (
    label: string,
    va: number | undefined,
    vb: number | undefined,
    higherIsBetter: boolean,
    fmt = pct,
  ) => {
    let better: 'a' | 'b' | undefined;
    if (
      va !== undefined &&
      vb !== undefined &&
      Number.isFinite(va) &&
      Number.isFinite(vb) &&
      Math.abs(va - vb) > 1e-3
    )
      better = va > vb === higherIsBetter ? 'a' : 'b';
    rows.push({ label, a: fmt(va), b: fmt(vb), better });
  };
  cmp('학습 정확도', a.metrics?.trainAccuracy, now.metrics?.trainAccuracy, true);
  cmp('검증 정확도', a.metrics?.testAccuracy, now.metrics?.testAccuracy, true);
  cmp('학습 손실', a.metrics?.trainLoss, now.metrics?.trainLoss, false, num);
  rows.push({
    label: 'Epoch',
    a: (a.metrics?.epoch ?? 0).toLocaleString(),
    b: (now.metrics?.epoch ?? 0).toLocaleString(),
  });

  return (
    <Card
      title="비교"
      testId="compare-card"
      aside={
        <button type="button" className={styles.clear} onClick={s.clearA}>
          지우기
        </button>
      }
    >
      <div className={styles.thumbs}>
        <figure>
          <BoundaryThumb
            grid={a.boundary}
            res={a.boundaryRes}
            dataset={a.dataset}
            size={THUMB}
            label="A의 결정 경계"
          />
          <figcaption>
            <b>A</b> {a.label}
          </figcaption>
        </figure>
        <figure>
          <BoundaryThumb
            grid={now.boundary}
            res={now.boundaryRes}
            dataset={s.dataset}
            size={THUMB}
            label="지금의 결정 경계"
          />
          <figcaption>
            <b>지금</b>
          </figcaption>
        </figure>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th />
            <th>A</th>
            <th>지금</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className={`num ${r.better === 'a' ? styles.better : ''}`}>{r.a}</td>
              <td className={`num ${r.better === 'b' ? styles.better : ''}`}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.changes}>
        <b>바꾼 것</b>
        {changes.length ? (
          <ul data-testid="compare-changes">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p>설정은 같아요. 학습 과정만 달라요.</p>
        )}
      </div>
    </Card>
  );
}
