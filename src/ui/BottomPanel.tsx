import { useState } from 'react';
import { CHART_COLORS, MetricChart } from '@viz/canvas2d/MetricChart';
import styles from './BottomPanel.module.css';

function ChartLegend() {
  return (
    <span className={styles.legend}>
      <span>
        <i style={{ borderColor: CHART_COLORS.train }} /> 학습
      </span>
      <span>
        <i style={{ borderColor: CHART_COLORS.test, borderTopStyle: 'dashed' }} /> 검증
      </span>
    </span>
  );
}

export function BottomPanel() {
  const [log, setLog] = useState(true);
  return (
    <section className={styles.panel} aria-label="학습 지표">
      <div className={styles.chart}>
        <header>
          <h2>손실</h2>
          <ChartLegend />
          <label className={styles.toggle}>
            <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> 로그 축
          </label>
        </header>
        <div className={styles.canvasWrap}>
          <MetricChart kind="loss" log={log} />
        </div>
      </div>
      <div className={styles.chart}>
        <header>
          <h2>정확도</h2>
          <ChartLegend />
        </header>
        <div className={styles.canvasWrap}>
          <MetricChart kind="accuracy" />
        </div>
      </div>
    </section>
  );
}
