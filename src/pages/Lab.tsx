import { useEffect, useState } from 'react';
import { useLab } from '@state/store';
import { NavBar } from '@ui/NavBar';
import { Sidebar } from '@ui/Sidebar';
import { Viewport } from '@ui/Viewport';
import { Welcome } from '@ui/Welcome';
import { useLesson } from '@state/lesson';
import styles from './Lab.module.css';

const PROBE_CYCLE_MS = 1500;

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey)
        return;
      const s = useLab.getState();
      switch (e.key) {
        case ' ':
          if (el.closest('button')) return; // let the focused button handle Space
          e.preventDefault();
          s.togglePlay();
          break;
        case '.':
          s.step();
          break;
        case 'r':
        case 'R':
          s.reset();
          break;
        case '1':
        case '2':
        case '3':
          s.requestCamera({ kind: 'preset', preset: Number(e.key) as 1 | 2 | 3 });
          break;
        case 'Escape':
          if (s.live.preview) s.exitPreview();
          else s.select(null);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          s.stepSnapshot(e.key === 'ArrowLeft' ? -1 : 1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useProbeCycle() {
  const auto = useLab((s) => s.probe.auto);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => useLab.getState().advanceProbe(), PROBE_CYCLE_MS);
    return () => clearInterval(id);
  }, [auto]);
}

export function Lab() {
  const [webgl] = useState(hasWebGL2);
  const [lessonParam] = useState(() => new URLSearchParams(window.location.search).get('lesson'));
  useEffect(() => useLab.getState().connect(), []);
  useEffect(() => {
    if (lessonParam) useLesson.getState().start(lessonParam);
  }, [lessonParam]);
  useKeyboardShortcuts();
  useProbeCycle();

  return (
    <div className={styles.lab}>
      <NavBar />
      <Welcome suppressed={!!lessonParam} />
      <Sidebar />
      {webgl ? (
        <Viewport />
      ) : (
        <main className={styles.noWebgl}>
          <p>이 브라우저에서는 WebGL 2를 사용할 수 없어 3D 뷰를 표시할 수 없습니다.</p>
          <p>최신 Chrome, Edge, Firefox, Safari에서 하드웨어 가속을 켜고 다시 시도해 주세요.</p>
        </main>
      )}
    </div>
  );
}
