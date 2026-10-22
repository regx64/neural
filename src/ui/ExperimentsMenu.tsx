import { useEffect, useRef, useState } from 'react';
import {
  deleteExperiment,
  listExperiments,
  MAX_SAVED,
  openExperiment,
  saveCurrent,
  suggestName,
  type SavedExperiment,
} from '@state/experiments';
import { shareUrl } from '@state/share';
import { layerSizesOf, useLab } from '@state/store';
import { CloseIcon } from './icons';
import styles from './ExperimentsMenu.module.css';

const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "내 실험": save the current experiment with its weights, reopen or delete saved ones, share a link. */
export function ExperimentsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedExperiment[]>([]);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
    setItems(listExperiments());
    setName(suggestName());
    setLink('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toast = useLab.getState().showToast;

  const save = () => {
    if (saveCurrent(name)) {
      setItems(listExperiments());
      toast('현재 실험을 가중치와 함께 저장했어요.');
    } else toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
  };

  const share = async () => {
    const url = await shareUrl(useLab.getState().config);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      toast('링크를 복사했어요. 받는 사람도 같은 학습을 그대로 재현할 수 있어요.');
    } catch {
      toast('아래 링크를 복사해 공유하세요.');
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        내 실험
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="내 실험" data-testid="experiments-menu">
          <header>
            <h2>내 실험</h2>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="닫기">
              <CloseIcon width={12} height={12} />
            </button>
          </header>

          <section>
            <p className={styles.label}>지금 실험 저장</p>
            <div className={styles.saveRow}>
              <input
                aria-label="실험 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <button type="button" className={styles.primary} onClick={save}>
                저장
              </button>
            </div>
            <p className={styles.note}>
              설정과 지금까지 학습한 가중치를 이 브라우저에 저장해요. 최대 {MAX_SAVED}개.
            </p>
          </section>

          <section>
            <p className={styles.label}>저장한 실험</p>
            {items.length === 0 ? (
              <p className={styles.empty}>아직 저장한 실험이 없어요.</p>
            ) : (
              <ul className={styles.list}>
                {items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => {
                        openExperiment(e);
                        setOpen(false);
                        toast(`"${e.name}"을(를) 불러왔어요.`);
                      }}
                    >
                      <b>{e.name}</b>
                      <span className="num">
                        {layerSizesOf(e.config).join('–')} · Epoch {e.epoch.toLocaleString()}
                        {e.trainAccuracy !== null && ` · ${Math.round(e.trainAccuracy * 100)}%`} ·{' '}
                        {dateFmt.format(e.savedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.delete}
                      aria-label={`${e.name} 삭제`}
                      onClick={() => {
                        deleteExperiment(e.id);
                        setItems(listExperiments());
                      }}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className={styles.label}>공유</p>
            <button type="button" className={styles.secondary} onClick={share}>
              링크 복사
            </button>
            {link && (
              <input
                className={styles.link}
                readOnly
                value={link}
                aria-label="공유 링크"
                data-testid="share-link"
                onFocus={(e) => e.currentTarget.select()}
              />
            )}
            <p className={styles.note}>
              링크에는 설정과 시드가 담겨요. 받는 사람의 브라우저에서 같은 데이터와 같은 학습이 그대로
              재현돼요.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
