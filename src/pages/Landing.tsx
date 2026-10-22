import { HeroDemo } from './HeroDemo';
import styles from './Landing.module.css';

const FEATURES = [
  {
    kicker: 'Explore',
    title: '3D로 탐험하는 신경망',
    body: '층·뉴런·연결을 3D 공간에서 돌려 보고 확대하세요. 연결선의 색과 두께는 실제 가중치, 뉴런의 밝기는 실제 활성화 값입니다.',
  },
  {
    kicker: 'Train',
    title: '눈앞에서 학습시키기',
    body: 'XOR, Circle, Spiral 같은 데이터셋을 고르고 ▶ 한 번이면 학습이 시작됩니다. 손실이 떨어지며 결정 경계가 만들어지는 과정을 지켜보세요.',
  },
  {
    kicker: 'Inspect',
    title: '모든 숫자를 추적하기',
    body: '뉴런을 클릭하면 z = Σwᵢaᵢ + b의 각 항이 그대로 보입니다. 어떤 입력이 결과를 만들었는지 계산 단위로 확인할 수 있습니다.',
  },
];

export function Landing() {
  const lab = `${import.meta.env.BASE_URL}lab/`;
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>
          <span className={styles.mark} aria-hidden /> NEURAL
        </span>
        <a href={lab} className={styles.navLink}>
          연구실
        </a>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Interactive Neural Network Lab</p>
          <h1>
            Don&apos;t just use AI.
            <br />
            <span>See how it thinks.</span>
          </h1>
          <p className={styles.lead}>
            NEURAL은 인공신경망을 3D 공간에서 탐험하고, 직접 학습시키며, 내부 계산 과정을 확인할 수 있는
            인터랙티브 연구실입니다. 화면의 모든 색과 움직임은 브라우저에서 실제로 계산된 값입니다.
          </p>
          <div className={styles.ctaRow}>
            <a href={lab} className={styles.cta} data-testid="enter-lab">
              연구실 입장 →
            </a>
            <span className={styles.ctaNote}>설치 없이 브라우저에서 바로 실행</span>
          </div>
        </div>
        <HeroDemo />
      </header>

      <section className={styles.features}>
        {FEATURES.map((f) => (
          <article key={f.kicker} className={styles.card}>
            <p className={styles.kicker}>{f.kicker}</p>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>React · Three.js · TypeScript · Web Worker — 신경망 엔진은 의존성 없이 직접 구현했습니다.</span>
        <a href="https://github.com/regx64/neural">GitHub</a>
      </footer>
    </div>
  );
}
