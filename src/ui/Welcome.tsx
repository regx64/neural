import { useState } from 'react';
import { readFlag, setFlag } from '@state/persist';
import { useLesson } from '@state/lesson';
import styles from './Welcome.module.css';

export const WELCOMED_KEY = 'neural.welcomed';

/** First-visit dialog: offer the 3-minute tour before dropping a newcomer into the full lab. */
export function Welcome({ suppressed }: { suppressed: boolean }) {
  const [open, setOpen] = useState(() => !suppressed && !readFlag(WELCOMED_KEY));
  if (!open) return null;
  const close = () => {
    setFlag(WELCOMED_KEY);
    setOpen(false);
  };
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className={styles.card}>
        <p className={styles.eyebrow}>NEURAL 연구실</p>
        <h2 id="welcome-title">AI가 처음이신가요?</h2>
        <p className={styles.lead}>
          걱정 마세요. 코드도, 수학도 몰라도 괜찮아요. 3분 투어에서 화면 보는 법과 첫 학습을 함께 해 볼게요.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              close();
              useLesson.getState().start('tour');
            }}
            autoFocus
          >
            3분 투어 시작
          </button>
          <a className={styles.secondary} href={`${import.meta.env.BASE_URL}learn/`} onClick={close}>
            기초부터 배우기 ›
          </a>
        </div>
        <button type="button" className={styles.skip} onClick={close}>
          괜찮아요, 바로 실험할게요
        </button>
      </div>
    </div>
  );
}
