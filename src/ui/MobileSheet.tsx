import type { ReactNode } from 'react';
import { useLab, type MobileTab } from '@state/store';
import { useLesson } from '@state/lesson';
import { CompareCard } from './CompareCard';
import { LessonCard } from './LessonCard';
import { AdvancedSettings, ChartCard, DataCard, NetworkCard } from './Sidebar';
import styles from './MobileSheet.module.css';

const svg = (children: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const TABS: { id: MobileTab; label: string; icon: ReactNode }[] = [
  {
    id: 'data',
    label: '데이터',
    icon: svg(
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="8.5" cy="9" r="1.2" fill="currentColor" />
        <circle cx="15" cy="7.5" r="1.2" fill="currentColor" />
        <circle cx="10" cy="15.5" r="1.2" fill="currentColor" />
        <circle cx="16" cy="15" r="1.2" fill="currentColor" />
      </>,
    ),
  },
  {
    id: 'network',
    label: '네트워크',
    icon: svg(
      <>
        <circle cx="5" cy="7" r="2" />
        <circle cx="5" cy="17" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
        <path d="M7 7.8 10 11M7 16.2 10 13M14 12h3" />
      </>,
    ),
  },
  {
    id: 'train',
    label: '학습 곡선',
    icon: svg(
      <>
        <path d="M3 4v16h18" />
        <path d="M6 7c3 0 3.5 7 7 8.5s5 .5 6.5.5" />
      </>,
    ),
  },
  {
    id: 'more',
    label: '설정',
    icon: svg(
      <>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </>,
    ),
  },
];

/** Phone layout: one panel at a time in a sheet above a tab bar, so the 3D view stays in sight. */
export function MobileSheet() {
  const tab = useLab((s) => s.mobileTab);
  const lesson = useLesson((s) => s.lesson);
  if (!tab && !lesson) return null;
  return (
    <section className={styles.sheet} aria-label="설정 패널" data-testid="mobile-sheet">
      <LessonCard />
      {tab === 'data' && <DataCard />}
      {tab === 'network' && <NetworkCard />}
      {tab === 'train' && (
        <>
          <ChartCard />
          <CompareCard />
        </>
      )}
      {tab === 'more' && <AdvancedSettings />}
    </section>
  );
}

export function MobileTabBar() {
  const tab = useLab((s) => s.mobileTab);
  const setTab = useLab((s) => s.setMobileTab);
  return (
    <nav className={styles.tabbar} aria-label="패널">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={tab === t.id}
          className={tab === t.id ? styles.active : undefined}
          // Tapping the open tab again folds the sheet away.
          onClick={() => setTab(tab === t.id ? null : t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
