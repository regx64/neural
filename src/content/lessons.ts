import { DEFAULT_CONFIG, type ExperimentConfig } from '@core/train/config';
import type { LabState } from '@state/store';

/** UI regions a lesson step can point at (matched by `data-tour` attributes). */
export type TourTarget = 'data' | 'draw' | 'viewport' | 'play' | 'stats' | 'network' | 'chart' | 'advanced';

/** Per-step memory so conditions like "reset, then train again" can be checked. */
export interface StepContext {
  /** An epoch-0 state was seen after the step began (i.e. the run was reset or re-created). */
  sawReset: boolean;
  /** Snapshot ids previewed during this step (Time Travel). */
  seen: number[];
  /** `LabState.resumes` when the step began. */
  resumesAtStart: number;
}

export interface LessonStep {
  title: string;
  /** Plain text; `**bold**` is rendered bold. */
  body: string;
  /** The one thing the learner should do now. Shown with a checkbox when `done` exists. */
  task?: string;
  target?: TourTarget;
  done?: (s: LabState, ctx: StepContext) => boolean;
  /** Opens the advanced settings when the step starts. */
  openAdvanced?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  config: ExperimentConfig;
  steps: LessonStep[];
}

const acc = (s: LabState) => s.live.metrics?.trainAccuracy ?? 0;
const epoch = (s: LabState) => s.live.metrics?.epoch ?? 0;
const D = DEFAULT_CONFIG;

export const LESSONS: Lesson[] = [
  {
    id: 'tour',
    title: '연구실 둘러보기',
    summary: '화면의 각 부분이 무엇인지 알아보고 첫 학습을 시켜 봐요.',
    minutes: 3,
    config: D,
    steps: [
      {
        title: '이것이 데이터예요',
        body: '파란 점과 주황 점은 AI가 배울 **예시**예요. AI의 목표는 두 색을 나누는 규칙을 스스로 찾는 거예요. 배경색은 AI가 지금 그 자리를 어떤 색으로 예상하는지 보여 줘요.',
        target: 'data',
      },
      {
        title: '이것이 신경망이에요',
        body: '동그라미 하나하나가 **뉴런**, 선이 **연결**이에요. 왼쪽 입력에서 오른쪽 출력으로 계산이 흘러가요. 선이 굵을수록 중요한 연결이고, 파랑은 +, 주황은 − 방향이에요.',
        target: 'viewport',
      },
      {
        title: '학습을 시작해 볼까요?',
        body: '학습이란 예시를 보고, 틀린 만큼 연결의 숫자(가중치)를 조금씩 고치는 과정을 수없이 반복하는 거예요.',
        task: '▶ 버튼을 눌러 보세요',
        target: 'play',
        done: (s) => s.live.running || epoch(s) > 0,
      },
      {
        title: 'AI가 배우는 중이에요',
        body: '**Epoch**는 예시 전체를 몇 번 봤는지, **손실**은 얼마나 틀렸는지예요. 손실이 줄고 정확도가 오르면 제대로 배우고 있다는 뜻이에요. 데이터 그림의 배경색도 함께 바뀌는 걸 보세요.',
        task: '정확도가 95%를 넘을 때까지 지켜보세요',
        target: 'stats',
        done: (s) => acc(s) >= 0.95,
      },
      {
        title: '뉴런 하나를 들여다봐요',
        body: '뉴런을 클릭하면 오른쪽에 그 뉴런의 계산이 그대로 나와요. 입력마다 가중치를 곱해 더하고(z), 활성화 함수를 거쳐 출력(a)을 만들어요. **응답 맵**은 이 뉴런이 어느 영역에서 반응하는지 보여 줘요.',
        task: '가운데 줄의 뉴런 하나를 클릭해 보세요',
        target: 'viewport',
        done: (s) => s.selection?.kind === 'neuron' && s.selection.layer >= 1,
      },
      {
        title: '투어 완료!',
        body: '이제 자유롭게 실험해 보세요. 데이터셋을 바꾸거나, 뉴런 수를 늘리거나, 직접 점을 찍어 볼 수도 있어요. 막히면 밑줄 친 용어에 마우스를 올려 보세요.',
      },
    ],
  },
  {
    id: 'hidden-layer',
    title: '선 하나로 안 될 때',
    summary: '왜 신경망에 은닉층이 필요한지 XOR 문제로 확인해요.',
    minutes: 4,
    config: { ...D, network: { ...D.network, hidden: [] } },
    steps: [
      {
        title: 'XOR 문제',
        body: '같은 색이 대각선으로 마주 보고 있어요. 이런 배치는 **직선 하나로는** 나눌 수 없어요. 지금 네트워크에는 은닉층이 없어서, 할 수 있는 일이 선 하나 긋기뿐이에요.',
        target: 'data',
      },
      {
        title: '일단 학습시켜 봐요',
        body: '아무리 오래 학습해도 정확도가 75% 근처에서 멈출 거예요. 모델이 게을러서가 아니라, 구조상 불가능하기 때문이에요.',
        task: '▶를 누르고 150 에폭까지 지켜보세요',
        target: 'play',
        done: (s) => epoch(s) >= 150,
      },
      {
        title: '은닉층 추가하기',
        body: '은닉층의 뉴런은 각자 선을 하나씩 그을 수 있어요. 출력 뉴런은 그 선들을 조합해 더 복잡한 경계를 만들어요.',
        task: '네트워크 카드의 + 버튼으로 은닉층을 하나 추가하세요',
        target: 'network',
        done: (s) => s.config.network.hidden.length >= 1,
      },
      {
        title: '다시 도전',
        body: '구조가 바뀌어서 가중치가 새로 시작됐어요. 이번에는 다를 거예요.',
        task: '▶를 누르고 정확도 95%를 넘겨 보세요',
        target: 'play',
        done: (s) => s.config.network.hidden.length >= 1 && acc(s) >= 0.95,
      },
      {
        title: '뉴런마다 선 하나씩',
        body: '은닉 뉴런을 클릭하고 **응답 맵**을 보세요. 뉴런 하나하나가 직선 하나씩을 맡고 있어요. 이 직선들을 겹치면 X자 모양 경계가 만들어져요.',
        task: '은닉층의 뉴런 하나를 클릭하세요',
        target: 'viewport',
        done: (s) =>
          s.selection?.kind === 'neuron' &&
          s.selection.layer >= 1 &&
          s.selection.layer <= s.config.network.hidden.length,
      },
      {
        title: '핵심 정리',
        body: '은닉층이 있으면 단순한 조각(직선)을 조합해 복잡한 모양을 만들 수 있어요. 이것이 신경망이 "깊어질수록" 강해지는 이유예요.',
      },
    ],
  },
  {
    id: 'features',
    title: '힌트를 주면 쉬워져요',
    summary: '입력 특성을 바꿔 주는 것만으로 문제가 쉬워지는 걸 봐요.',
    minutes: 3,
    config: { ...D, dataset: { ...D.dataset, id: 'circle' }, network: { ...D.network, hidden: [] } },
    steps: [
      {
        title: '원 모양 데이터',
        body: '파란 점이 가운데, 주황 점이 바깥을 둘러싸고 있어요. 은닉층이 없으니 역시 직선 하나로는 나눌 수 없어요.',
        task: '▶를 누르고 100 에폭까지 지켜보세요',
        target: 'play',
        done: (s) => epoch(s) >= 100,
      },
      {
        title: '힌트 켜기',
        body: '**x₁²**와 **x₂²**는 "가운데서 얼마나 먼가"를 알려 주는 힌트예요. 원 안쪽은 이 값이 작고 바깥은 커요.',
        task: '고급 설정의 입력 특성에서 x₁²와 x₂²를 켜세요',
        target: 'advanced',
        openAdvanced: true,
        done: (s) => s.config.network.features.includes('x1sq') && s.config.network.features.includes('x2sq'),
      },
      {
        title: '다시 학습',
        body: '입력이 바뀌어서 네트워크 왼쪽에 입력 뉴런이 늘어났어요.',
        task: '▶를 누르고 정확도 95%를 넘겨 보세요',
        target: 'play',
        done: (s) => s.config.network.features.includes('x1sq') && acc(s) >= 0.95,
      },
      {
        title: '핵심 정리',
        body: '같은 모델도 어떤 정보를 주느냐에 따라 결과가 크게 달라져요. 이런 작업을 **특성 공학**이라고 해요. 은닉층은 이런 힌트를 스스로 만들어 내는 역할도 해요.',
      },
    ],
  },
  {
    id: 'learning-rate',
    title: '학습률: 보폭 정하기',
    summary: '너무 큰 보폭과 너무 작은 보폭이 학습을 어떻게 망치는지 봐요.',
    minutes: 4,
    config: { ...D, dataset: { ...D.dataset, id: 'circle' }, hyper: { ...D.hyper, learningRate: 3 } },
    steps: [
      {
        title: '보폭이 너무 클 때',
        body: '**학습률**은 가중치를 한 번에 얼마나 크게 고칠지예요. 지금은 3으로 아주 커요. 정답 근처를 지나쳐 버리고 이리저리 널뛰게 돼요.',
        task: '▶를 누르고 학습 곡선을 지켜보세요 (150 에폭)',
        target: 'chart',
        done: (s) => epoch(s) >= 150,
      },
      {
        title: '보폭이 너무 작을 때',
        body: '이번엔 반대로 아주 작게 해 볼게요. 방향은 맞지만 거의 움직이지 않아요.',
        task: '학습률을 0.0001로 바꾸고 ↺ 초기화한 뒤 다시 학습하세요 (150 에폭)',
        target: 'advanced',
        openAdvanced: true,
        done: (s, ctx) => s.config.hyper.learningRate <= 0.0001 && ctx.sawReset && epoch(s) >= 150,
      },
      {
        title: '알맞은 보폭',
        body: '이제 적당한 값을 써 볼게요.',
        task: '학습률을 0.03으로 바꾸고 ↺ 초기화한 뒤 정확도 95%를 넘겨 보세요',
        target: 'advanced',
        openAdvanced: true,
        done: (s, ctx) =>
          s.config.hyper.learningRate >= 0.01 &&
          s.config.hyper.learningRate <= 0.1 &&
          ctx.sawReset &&
          acc(s) >= 0.95,
      },
      {
        title: '핵심 정리',
        body: '학습률은 가장 먼저 조정해 보는 설정이에요. 손실이 널뛰면 줄이고, 너무 느리면 키워 보세요.',
      },
    ],
  },
  {
    id: 'overfitting',
    title: '외우기와 이해하기',
    summary: '과적합이 무엇인지, 어떻게 막는지 알아봐요.',
    minutes: 4,
    config: {
      ...D,
      dataset: { id: 'xor', samples: 60, noise: 0.5, trainRatio: 0.5 },
      network: { ...D.network, hidden: [16, 16, 16] },
    },
    steps: [
      {
        title: '작은 데이터, 큰 모델',
        body: '예시는 적고 시끄러운데, 네트워크는 아주 커요. 이런 모델은 규칙을 배우는 대신 예시를 통째로 **외워** 버리기 쉬워요.',
        task: '▶를 누르고 300 에폭까지 지켜보세요',
        target: 'play',
        done: (s) => epoch(s) >= 300,
      },
      {
        title: '시험 성적이 다르다',
        body: '학습 정확도는 100%에 가깝지만, 처음 보는 **검증** 데이터의 정확도는 훨씬 낮아요. 데이터 그림의 경계도 점 하나하나를 피해 구불구불하죠. 이것이 **과적합**이에요.',
        target: 'stats',
      },
      {
        title: '벌점 주기',
        body: '**L2 정규화**는 가중치가 너무 커지면 벌점을 줘요. 모델이 점 하나하나에 매달리지 않고 단순한 경계를 찾게 돼요.',
        task: 'L2 정규화를 0.01로 바꾸고 ↺ 초기화한 뒤 300 에폭까지 학습하세요',
        target: 'advanced',
        openAdvanced: true,
        done: (s, ctx) => s.config.hyper.l2 >= 0.01 && ctx.sawReset && epoch(s) >= 300,
      },
      {
        title: '핵심 정리',
        body: '좋은 모델은 학습 데이터만이 아니라 처음 보는 데이터도 잘 맞혀요. 검증 정확도를 늘 함께 보는 습관을 들이세요.',
      },
    ],
  },
  {
    id: 'time-travel',
    title: '학습 과정 되감기',
    summary: '학습을 녹화한 기록을 되감아 보고, 과거에서 다른 길로 가 봐요.',
    minutes: 3,
    config: D,
    steps: [
      {
        title: '먼저 학습시키기',
        body: '학습하는 동안 NEURAL은 모델의 상태를 자동으로 **기록**해 둬요. 동영상처럼 나중에 되감아 볼 수 있어요.',
        task: '▶를 누르고 정확도 95%를 넘겨 보세요',
        target: 'play',
        done: (s) => acc(s) >= 0.95,
      },
      {
        title: '처음으로 되감기',
        body: '학습 곡선 아래의 점들이 기록된 시점이에요. 곡선의 왼쪽 끝을 누르면 학습 초기의 네트워크로 돌아가요. 3D와 데이터 그림이 모두 그때 모습으로 바뀌어요.',
        task: '학습 곡선의 왼쪽 끝(Epoch 20 이전)을 눌러 보세요',
        target: 'chart',
        done: (s) => !!s.live.preview && s.live.preview.epoch <= 20,
      },
      {
        title: '경계가 생기는 과정',
        body: '곡선 위를 누른 채 오른쪽으로 끌거나 키보드 ← → 키를 눌러 보세요. 선이 엉뚱한 곳에 있다가 점점 X자로 자리를 잡아 가요.',
        task: '서로 다른 시점을 4곳 이상 둘러보세요',
        target: 'chart',
        done: (_, ctx) => ctx.seen.length >= 4,
      },
      {
        title: '과거에서 다른 길로',
        body: '과거 시점에서 **여기서 다시 학습**을 누르면 그 순간의 가중치로 돌아가 학습을 이어 가요. 그 전에 학습률 같은 설정을 바꾸면 "그때 이랬다면?"을 실험할 수 있어요.',
        task: '과거 시점에서 "여기서 다시 학습"을 누르세요',
        target: 'viewport',
        done: (s, ctx) => s.resumes > ctx.resumesAtStart,
      },
      {
        title: '핵심 정리',
        body: '학습은 한 번에 일어나지 않아요. 수많은 작은 수정이 쌓여 경계가 만들어져요. 기록을 되감아 보면 모델이 언제 무엇을 배웠는지 알 수 있어요.',
      },
    ],
  },
];

export function findLesson(id: string | null | undefined): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
