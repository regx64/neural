import { useLab } from '@state/store';
import type { Speed } from '@worker/protocol';
import { formatNumber } from '@viz/encoding';
import { Select } from './controls';
import { useLiveTick } from './hooks';
import { DiceIcon, PauseIcon, PlayIcon, ResetIcon, StepIcon } from './icons';
import styles from './TopBar.module.css';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 5, label: '5 에폭/초' },
  { value: 15, label: '15 에폭/초' },
  { value: 50, label: '50 에폭/초' },
  { value: 150, label: '150 에폭/초' },
  { value: 'max', label: '최대 속도' },
];

const pct = (v: number | undefined) =>
  v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`;

function Metrics() {
  useLiveTick(15);
  const { metrics, epochsPerSecond, running } = useLab.getState().live;
  const items = [
    { label: 'Epoch', value: metrics ? metrics.epoch.toLocaleString() : '0', id: 'epoch' },
    { label: '학습 손실', value: metrics ? formatNumber(metrics.trainLoss) : '—', id: 'train-loss' },
    { label: '검증 손실', value: metrics ? formatNumber(metrics.testLoss) : '—', id: 'test-loss' },
    { label: '학습 정확도', value: pct(metrics?.trainAccuracy), id: 'train-acc' },
    { label: '검증 정확도', value: pct(metrics?.testAccuracy), id: 'test-acc' },
    { label: '속도', value: running ? `${Math.round(epochsPerSecond).toLocaleString()}/s` : '—', id: 'eps' },
  ];
  return (
    <dl className={styles.metrics}>
      {items.map((m) => (
        <div key={m.id}>
          <dt>{m.label}</dt>
          <dd className="mono" data-testid={`metric-${m.id}`}>
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TopBar() {
  const running = useLab((s) => s.live.running);
  const speed = useLab((s) => s.speed);
  const { togglePlay, step, reset, newSeed, setSpeed } = useLab.getState();
  return (
    <header className={styles.bar}>
      <a className={styles.logo} href={import.meta.env.BASE_URL}>
        <span className={styles.mark} aria-hidden />
        NEURAL
      </a>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.play}
          onClick={togglePlay}
          aria-label={running ? '일시정지' : '학습 시작'}
          title={running ? '일시정지 (Space)' : '학습 시작 (Space)'}
          data-testid="play"
        >
          {running ? <PauseIcon /> : <PlayIcon />}
          <span>{running ? '일시정지' : '학습'}</span>
        </button>
        <button
          type="button"
          className={styles.icon}
          onClick={step}
          title="1 에폭 진행 (.)"
          aria-label="1 에폭 진행"
        >
          <StepIcon />
        </button>
        <button
          type="button"
          className={styles.icon}
          onClick={reset}
          title="가중치 초기화 (R)"
          aria-label="가중치 초기화"
        >
          <ResetIcon />
        </button>
        <button
          type="button"
          className={styles.icon}
          onClick={newSeed}
          title="새 시드로 데이터·가중치 생성"
          aria-label="새 시드"
        >
          <DiceIcon />
        </button>
        <div className={styles.speed}>
          <Select label="학습 속도" value={speed} options={SPEEDS} onChange={setSpeed} />
        </div>
      </div>
      <Metrics />
    </header>
  );
}
