/**
 * One plain-language sentence about what the model is doing right now, for first-time learners.
 * Pure so it can be unit-tested; the lab passes in the latest metrics and loss history.
 */
export interface NarrationInput {
  running: boolean;
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  testAccuracy: number;
  /** Training loss about 100 epochs ago, if known. */
  pastLoss?: number;
  sampleCount: number;
}

export type Tone = 'idle' | 'learning' | 'good' | 'warn';

export function narrate(n: NarrationInput): { text: string; tone: Tone } {
  if (n.sampleCount < 2) return { text: '점을 2개 이상 찍으면 학습할 수 있어요.', tone: 'idle' };
  if (n.epoch === 0) return { text: '▶ 버튼을 누르면 학습이 시작돼요.', tone: 'idle' };
  if (!Number.isFinite(n.trainLoss) || (n.epoch > 30 && n.trainLoss > 1.5))
    return { text: '손실이 널뛰고 있어요. 학습률이 너무 큰 것 같아요.', tone: 'warn' };
  const gap = n.trainAccuracy - n.testAccuracy;
  if (n.trainAccuracy >= 0.95 && Number.isFinite(gap) && gap >= 0.12)
    return {
      text: '학습 데이터는 다 맞히지만 처음 보는 검증 데이터는 자주 틀려요. 과적합일 수 있어요.',
      tone: 'warn',
    };
  if (n.trainAccuracy >= 0.97)
    return { text: '거의 다 맞혀요! 뉴런을 클릭해 어떻게 판단하는지 들여다보세요.', tone: 'good' };
  const stalled =
    n.pastLoss !== undefined && n.epoch >= 150 && Math.abs(n.pastLoss - n.trainLoss) < 0.005 * n.pastLoss;
  if (stalled && n.trainAccuracy < 0.85)
    return { text: '더 나아지지 않고 멈췄어요. 은닉층이나 뉴런을 늘려 보세요.', tone: 'warn' };
  if (!n.running) return { text: '일시정지했어요. ▶로 이어서 학습할 수 있어요.', tone: 'idle' };
  if (n.trainAccuracy >= 0.8)
    return { text: '꽤 잘 맞히고 있어요. 경계를 다듬는 중이에요.', tone: 'learning' };
  return { text: '아직은 찍는 수준이에요. 틀린 만큼 가중치를 조금씩 고치는 중이에요.', tone: 'learning' };
}
