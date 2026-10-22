import styles from './SiteNav.module.css';

/** Sticky translucent navigation shared by the marketing-style pages. */
export function SiteNav({ current }: { current: 'home' | 'learn' }) {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <a href={base} className={styles.logo}>
          NEURAL
        </a>
        <div className={styles.links}>
          <a href={`${base}learn/`} aria-current={current === 'learn' ? 'page' : undefined}>
            배우기
          </a>
          <a href={`${base}lab/`}>연구실</a>
        </div>
      </div>
    </nav>
  );
}
