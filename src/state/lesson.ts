import { create } from 'zustand';
import { findLesson, type Lesson, type StepContext } from '../content/lessons';
import { useLab } from './store';

interface LessonState {
  lesson: Lesson | null;
  step: number;
  /** Steps whose task has been completed (by index) — completion sticks once reached. */
  completed: Set<number>;
  ctx: StepContext;
  start(id: string): void;
  goTo(step: number): void;
  exit(): void;
}

const freshCtx = (): StepContext => ({
  sawReset: false,
  seen: [],
  resumesAtStart: useLab.getState().resumes,
});

function enterStep(lesson: Lesson, step: number) {
  if (lesson.steps[step]?.openAdvanced) useLab.getState().setAdvancedOpen(true);
}

export const useLesson = create<LessonState>()((set, get) => ({
  lesson: null,
  step: 0,
  completed: new Set(),
  ctx: freshCtx(),
  start(id) {
    const lesson = findLesson(id);
    if (!lesson) return;
    useLab.getState().loadConfig(lesson.config);
    set({ lesson, step: 0, completed: new Set(), ctx: freshCtx() });
    enterStep(lesson, 0);
  },
  goTo(step) {
    const { lesson } = get();
    if (!lesson || step < 0 || step >= lesson.steps.length) return;
    set({ step, ctx: freshCtx() });
    enterStep(lesson, step);
  },
  exit: () => set({ lesson: null, step: 0, completed: new Set(), ctx: freshCtx() }),
}));

// Check the current step's task whenever the lab changes.
useLab.subscribe((s) => {
  const { lesson, step, completed, ctx } = useLesson.getState();
  if (!lesson) return;
  const st = lesson.steps[step];
  if (s.live.preview) {
    if (!ctx.seen.includes(s.live.preview.id)) ctx.seen.push(s.live.preview.id);
  } else {
    // Only the live run counts as progress; a previewed past state does not.
    if ((s.live.metrics?.epoch ?? 0) === 0) ctx.sawReset = true;
  }
  if (!st.done || completed.has(step)) return;
  if (st.done(s, ctx)) useLesson.setState({ completed: new Set(completed).add(step) });
});
