import { useLesson } from '@state/lesson';
import { ExperimentsMenu } from './ExperimentsMenu';
import styles from './NavBar.module.css';

export function NavBar() {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className={styles.nav}>
      <a className={styles.logo} href={base}>
        NEURAL
      </a>
      <span className={styles.title}>연구실</span>
      <div className={styles.links}>
        <ExperimentsMenu />
        <button
          type="button"
          className={`${styles.link} ${styles.hideSmall}`}
          onClick={() => useLesson.getState().start('tour')}
        >
          둘러보기
        </button>
        <a className={styles.link} href={`${base}learn/`}>
          배우기
        </a>
        <a className={`${styles.link} ${styles.hideSmall}`} href={base}>
          소개
        </a>
      </div>
    </nav>
  );
}
