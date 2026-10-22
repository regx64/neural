import { SiteNav } from '@ui/SiteNav';
import { HeroDemo } from './HeroDemo';
import styles from './Landing.module.css';

const FEATURES = [
  {
    title: '탐험',
    headline: '신경망을 손으로 돌려 보세요.',
    body: '층과 뉴런, 연결을 3D로 살펴봅니다. 연결선의 색과 굵기는 실제 가중치, 뉴런의 색은 실제 활성화 값입니다.',
  },
  {
    title: '학습',
    headline: '배우는 순간을 지켜보세요.',
    body: '데이터를 고르고 재생 버튼을 누르면 학습이 시작됩니다. 손실이 줄며 경계가 그려지는 과정이 그대로 보입니다.',
  },
  {
    title: '계산',
    headline: '모든 숫자의 출처를 확인하세요.',
    body: '뉴런을 누르면 z = Σ w·a + b의 각 항이 나타납니다. 어떤 입력이 결과를 만들었는지 한눈에 알 수 있습니다.',
  },
];

export function Landing() {
  const lab = `${import.meta.env.BASE_URL}lab/`;
  return (
    <div className={styles.page}>
      <SiteNav current="home" />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>NEURAL</p>
        <h1>See how it thinks.</h1>
        <p className={styles.lead}>신경망을 직접 학습시키고, 그 생각을 들여다보세요.</p>
        <div className={styles.ctaRow}>
          <a href={lab} className={styles.cta} data-testid="enter-lab">
            연구실 입장
          </a>
          <a href={`${import.meta.env.BASE_URL}learn/`} className={styles.more}>
            AI가 처음이라면 여기부터 <span aria-hidden>›</span>
          </a>
        </div>
        <HeroDemo />
      </header>

      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>보이는 것은 모두 진짜입니다.</h2>
        <p className={styles.sectionLead}>화면의 모든 색과 움직임은 지금 이 브라우저에서 계산된 값입니다.</p>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <p className={styles.kicker}>{f.title}</p>
              <h3>{f.headline}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <h2>브라우저 하나면 충분합니다.</h2>
        <p>설치도, 가입도 필요 없습니다. 처음이라면 10분짜리 입문 과정부터 시작해 보세요.</p>
        <div className={styles.ctaRow}>
          <a href={`${import.meta.env.BASE_URL}learn/`} className={styles.cta}>
            배우기 시작
          </a>
          <a href={lab} className={styles.more}>
            연구실 바로 가기 <span aria-hidden>›</span>
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>React · Three.js · TypeScript · Web Worker. 신경망 엔진은 의존성 없이 직접 구현했습니다.</span>
        <a href="https://github.com/regx64/neural">GitHub</a>
      </footer>
    </div>
  );
}
