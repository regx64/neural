import { useLab } from '@state/store';
import { CloseIcon } from './icons';
import styles from './Shortcuts.module.css';

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: '학습',
    keys: [
      [['Space'], '학습 시작 / 일시정지'],
      [['.'], '1 에폭 진행'],
      [['R'], '가중치 초기화'],
    ],
  },
  {
    title: '살펴보기',
    keys: [
      [['[', ']'], '이전 / 다음 뉴런 선택'],
      [['Esc'], '선택 해제 · 과거 보기 끝내기'],
      [['1', '2', '3'], '정면 · 측면 · 등각 보기'],
      [['더블클릭'], '뉴런으로 카메라 이동'],
    ],
  },
  {
    title: '타임 트래블',
    keys: [[['←', '→'], '이전 / 다음 기록 시점']],
  },
];

export function Shortcuts() {
  const open = useLab((s) => s.shortcutsOpen);
  if (!open) return null;
  const close = () => useLab.getState().setShortcutsOpen(false);
  return (
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id="shortcuts-title">키보드 단축키</h2>
          <button type="button" className={styles.close} onClick={close} aria-label="닫기" autoFocus>
            <CloseIcon width={12} height={12} />
          </button>
        </header>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <dl>
              {g.keys.map(([keys, what]) => (
                <div key={what}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
