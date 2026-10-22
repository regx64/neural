import styles from './NavBar.module.css';

export function NavBar() {
  return (
    <nav className={styles.nav}>
      <a className={styles.logo} href={import.meta.env.BASE_URL}>
        NEURAL
      </a>
      <span className={styles.title}>연구실</span>
      <a className={styles.link} href={import.meta.env.BASE_URL}>
        소개
      </a>
    </nav>
  );
}
