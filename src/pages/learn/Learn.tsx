import { GLOSSARY } from '../../content/glossary';
import { LESSONS } from '../../content/lessons';
import { SiteNav } from '@ui/SiteNav';
import { CSS_COLORS } from '@viz/encoding';
import { LossValley } from './LossValley';
import { NeuronPlayground } from './NeuronPlayground';
import styles from './Learn.module.css';

const CHAPTERS = [
  { id: 'examples', label: '예시로 배워요' },
  { id: 'neuron', label: '뉴런 하나' },
  { id: 'loss', label: '학습이란' },
  { id: 'layers', label: '층 쌓기' },
  { id: 'lessons', label: '연구실 레슨' },
];

/** Deterministic little scatter for the XOR illustration. */
function XorFigure() {
  const pts: [number, number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < 48; k++) {
    const px = rnd() * 0.85;
    const py = rnd() * 0.85;
    pts.push([px + Math.sign(px) * 0.12, py + Math.sign(py) * 0.12, px * py > 0 ? 1 : 0]);
  }
  const s = (v: number) => 110 + v * 100;
  return (
    <svg viewBox="0 0 220 220" className={styles.xor} aria-label="XOR 데이터: 대각선끼리 같은 색">
      <rect x={0} y={0} width={220} height={220} rx={16} fill="#fff" />
      {pts.map(([px, py, c], k) => (
        <circle
          key={k}
          cx={s(px)}
          cy={s(-py)}
          r={4.5}
          fill={c ? CSS_COLORS.positive : CSS_COLORS.negative}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}
      <line
        x1={20}
        y1={200}
        x2={200}
        y2={20}
        stroke={CSS_COLORS.ink}
        strokeWidth={2}
        strokeDasharray="6 5"
        opacity={0.5}
      />
      <text x={190} y={46} textAnchor="end" className={styles.xorNo}>
        ✕
      </text>
    </svg>
  );
}

export function Learn() {
  const lab = `${import.meta.env.BASE_URL}lab/`;
  return (
    <div className={styles.page}>
      <SiteNav current="learn" />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>배우기</p>
        <h1>처음 만나는 신경망.</h1>
        <p className={styles.lead}>
          코드도, 수학도 필요 없어요.
          <br />
          직접 만져 보며 10분 만에 원리를 익혀요.
        </p>
        <nav className={styles.chapters} aria-label="목차">
          {CHAPTERS.map((c, k) => (
            <a key={c.id} href={`#${c.id}`}>
              <span>{k + 1}</span>
              {c.label}
            </a>
          ))}
        </nav>
      </header>

      <section id="examples" className={styles.section}>
        <p className={styles.kicker}>1 · 예시로 배워요</p>
        <h2>AI는 규칙을 외우지 않아요. 예시에서 찾아내요.</h2>
        <p className={styles.text}>
          사람이 "이 영역은 파랑" 같은 규칙을 직접 적어 주지 않아요. 대신 정답이 표시된 예시를 잔뜩 보여 주면,
          AI가 그 예시들을 가장 잘 설명하는 규칙을 스스로 찾아요. 이 과정을 <b>학습</b>이라고 해요.
        </p>
        <div className={styles.facts}>
          <div>
            <b>예시</b>
            <span>위치(x₁, x₂)와 정답 색이 붙은 점들</span>
          </div>
          <div>
            <b>모델</b>
            <span>점의 위치를 받아 색을 예측하는 계산 장치 (신경망)</span>
          </div>
          <div>
            <b>학습</b>
            <span>예측이 틀린 만큼 모델 속 숫자를 조금씩 고치기</span>
          </div>
        </div>
      </section>

      <section id="neuron" className={`${styles.section} ${styles.gray}`}>
        <p className={styles.kicker}>2 · 뉴런 하나</p>
        <h2>뉴런 하나는 선 하나를 그어요.</h2>
        <p className={styles.text}>
          가장 작은 신경망은 뉴런 하나예요. 점의 좌표에 <b>가중치</b>를 곱해 더하고 <b>편향</b>을 더해요:{' '}
          <span className={styles.formula}>z = w₁·x₁ + w₂·x₂ + b</span>. z가 0보다 크면 파랑, 작으면 주황으로
          판단해요. z = 0이 되는 곳이 바로 경계선이에요. 슬라이더로 직접 선을 움직여 보세요.
        </p>
        <NeuronPlayground />
      </section>

      <section id="loss" className={styles.section}>
        <p className={styles.kicker}>3 · 학습이란</p>
        <h2>학습은 골짜기를 내려가는 일이에요.</h2>
        <p className={styles.text}>
          <b>손실</b>은 얼마나 틀렸는지를 나타내는 점수예요. 가중치를 바꾸면 손실도 바뀌어서, 가중치와 손실의
          관계는 언덕과 골짜기 모양이 돼요. 컴퓨터는 지금 위치의 기울기를 보고 내리막 쪽으로 한 걸음씩
          이동해요. 이것이 <b>경사 하강법</b>이에요. 한 걸음의 크기를 정하는 값이 <b>학습률</b>이에요.
        </p>
        <LossValley />
      </section>

      <section id="layers" className={`${styles.section} ${styles.gray}`}>
        <p className={styles.kicker}>4 · 층 쌓기</p>
        <h2>선 하나로 안 될 때는 층을 쌓아요.</h2>
        <div className={styles.split}>
          <XorFigure />
          <div>
            <p className={styles.text}>
              같은 색이 대각선으로 마주 보는 데이터예요. 아무리 선을 돌려도 직선 하나로는 나눌 수 없어요.
            </p>
            <p className={styles.text}>
              해결책은 뉴런을 여러 개 두는 거예요. 가운데 층(<b>은닉층</b>)의 뉴런들이 각자 선을 하나씩 긋고,
              마지막 뉴런이 그 선들을 조합하면 X자 경계도 만들 수 있어요. 층을 깊게 쌓을수록 더 복잡한 모양을
              배울 수 있어요. 이게 "딥러닝"의 "딥"이에요.
            </p>
            <a className={styles.cta} href={`${lab}?lesson=hidden-layer`}>
              연구실에서 직접 해 보기
            </a>
          </div>
        </div>
      </section>

      <section id="lessons" className={styles.section}>
        <p className={styles.kicker}>5 · 연구실 레슨</p>
        <h2>이제 연구실에서 직접 실험해 봐요.</h2>
        <p className={styles.text}>
          레슨을 고르면 연구실이 알맞게 준비되고, 단계마다 무엇을 보고 무엇을 눌러야 하는지 알려 줘요.
        </p>
        <ol className={styles.lessons}>
          {LESSONS.map((l, k) => (
            <li key={l.id}>
              <a href={`${lab}?lesson=${l.id}`} data-testid={`lesson-link-${l.id}`}>
                <span className={styles.lessonNo}>{k + 1}</span>
                <span className={styles.lessonBody}>
                  <b>{l.title}</b>
                  <span>{l.summary}</span>
                </span>
                <span className={styles.lessonMeta}>{l.minutes}분 ›</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.gray}`}>
        <p className={styles.kicker}>용어 사전</p>
        <h2>모르는 말이 나오면 여기서.</h2>
        <p className={styles.text}>연구실에서도 점선 밑줄이 있는 말에 마우스를 올리면 같은 설명이 나와요.</p>
        <dl className={styles.glossary}>
          {Object.values(GLOSSARY).map((g) => (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className={styles.footer}>
        <span>NEURAL · 브라우저에서 실제로 계산되는 신경망으로 배우는 AI</span>
      </footer>
    </div>
  );
}
