import { useEffect } from 'react';
import { useLesson } from '@state/lesson';
import { CheckIcon, CloseIcon } from './icons';
import { rich } from './rich';
import styles from './LessonCard.module.css';

const HIGHLIGHT = 'tour-highlight';

/** The active lesson step: what to look at, what to do, and whether it's done. */
export function LessonCard() {
  const { lesson, step, completed, goTo, exit } = useLesson();
  const st = lesson?.steps[step];

  // Point at the UI region this step is about.
  useEffect(() => {
    if (!st?.target) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${st.target}"]`));
    els.forEach((el) => el.classList.add(HIGHLIGHT));
    els[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => els.forEach((el) => el.classList.remove(HIGHLIGHT));
  }, [st]);

  if (!lesson || !st) return null;
  const last = step === lesson.steps.length - 1;
  const done = !st.done || completed.has(step);

  return (
    <section className={styles.card} aria-live="polite" data-testid="lesson-card">
      <header className={styles.header}>
        <span>
          레슨 · {lesson.title}
          <span className={styles.count}>
            {step + 1} / {lesson.steps.length}
          </span>
        </span>
        <button type="button" className={styles.close} onClick={exit} aria-label="레슨 닫기">
          <CloseIcon width={12} height={12} />
        </button>
      </header>
      <div className={styles.progress} aria-hidden>
        {lesson.steps.map((_, k) => (
          <span key={k} className={k <= step ? styles.dotOn : undefined} />
        ))}
      </div>
      <h2>{st.title}</h2>
      <p className={styles.body}>{rich(st.body)}</p>
      {st.task && (
        <div className={done ? styles.taskDone : styles.task} data-testid="lesson-task">
          <span className={styles.check}>{done && <CheckIcon width={12} height={12} />}</span>
          <span>{done ? `${st.task} — 잘했어요!` : st.task}</span>
        </div>
      )}
      <footer className={styles.footer}>
        {step > 0 ? (
          <button type="button" className={styles.back} onClick={() => goTo(step - 1)}>
            이전
          </button>
        ) : (
          <span />
        )}
        <div className={styles.right}>
          {!done && (
            <button type="button" className={styles.skip} onClick={() => goTo(step + 1)}>
              건너뛰기
            </button>
          )}
          {last ? (
            <a className={styles.next} href={`${import.meta.env.BASE_URL}learn/#lessons`} onClick={exit}>
              다른 레슨 보기
            </a>
          ) : (
            <button type="button" className={styles.next} disabled={!done} onClick={() => goTo(step + 1)}>
              다음
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
