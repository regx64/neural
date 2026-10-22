import { DATASETS } from '@core/data/datasets';
import { featureLabel } from '@core/data/features';
import type { ExperimentConfig } from '@core/train/config';

const datasetName = (id: string) =>
  id === 'custom' ? '직접 그린 데이터' : (DATASETS.find((d) => d.id === id)?.label ?? id);
const layers = (h: number[]) => (h.length ? h.join(', ') : '없음');
const batch = (b: number) => (b === 0 ? '전체' : String(b));

/** What changed between two experiments, as short plain-language lines for the compare card. */
export function describeChanges(a: ExperimentConfig, b: ExperimentConfig): string[] {
  const out: string[] = [];
  const add = (label: string, x: string | number, y: string | number) => {
    if (String(x) !== String(y)) out.push(`${label} ${x} → ${y}`);
  };
  add('데이터셋', datasetName(a.dataset.id), datasetName(b.dataset.id));
  if (a.dataset.id === b.dataset.id && a.dataset.id === 'custom') {
    add('점 개수', a.dataset.labels?.length ?? 0, b.dataset.labels?.length ?? 0);
  } else if (a.dataset.id === b.dataset.id) {
    add('샘플 수', a.dataset.samples, b.dataset.samples);
    add('노이즈', a.dataset.noise, b.dataset.noise);
    add(
      '학습 데이터 비율',
      `${Math.round(a.dataset.trainRatio * 100)}%`,
      `${Math.round(b.dataset.trainRatio * 100)}%`,
    );
  }
  add('은닉층', layers(a.network.hidden), layers(b.network.hidden));
  add('활성화 함수', a.network.activation, b.network.activation);
  add(
    '입력 특성',
    a.network.features.map(featureLabel).join(' '),
    b.network.features.map(featureLabel).join(' '),
  );
  add('학습률', a.hyper.learningRate, b.hyper.learningRate);
  add('옵티마이저', a.hyper.optimizer, b.hyper.optimizer);
  add('배치 크기', batch(a.hyper.batchSize), batch(b.hyper.batchSize));
  add('L2 정규화', a.hyper.l2, b.hyper.l2);
  add('시드', a.seed, b.seed);
  return out;
}
