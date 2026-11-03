import { useEffect, useId, type MouseEvent } from 'react';
import { memberColor } from '../../lib/members';
import { IconFriend } from './icons';
import './DestinationPicker.css';

export interface DestinationPickerProps {
  /** 候補の友達（自分と、今いる友達の島の主は親が除いて渡す） */
  friends: string[];
  /** 色用（memberColor(members, name)） */
  members: string[];
  /** 自分の名前（「自分の島に戻る」の表示用） */
  currentUser: string;
  /** 友達の島にいるとき true：「自分の島に戻る」を出す */
  showHome: boolean;
  onPickFriend: (name: string) => void;
  onPickHome: () => void;
  onClose: () => void;
}

/**
 * 行き先選択のポップアップ。背景をぼかして暗幕をかけ、中央の看板に友達ごとのボタンを並べる。
 * 外側クリックか Escape で閉じる。開いたときは最初のボタンにフォーカスを置く
 */
export const DestinationPicker = ({
  friends,
  members,
  currentUser,
  showHome,
  onPickFriend,
  onPickHome,
  onClose,
}: DestinationPickerProps) => {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const onOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const hasFriends = friends.length > 0;
  const isEmpty = !hasFriends && !showHome;

  return (
    <div className="dest" onClick={onOverlayClick}>
      <section className="dest-panel panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="dest-title">
          <IconFriend size={32} />
          どこへ行く？
        </h2>

        {isEmpty ? (
          <>
            <p className="dest-empty">まだ友達がいません</p>
            <button type="button" className="btn dest-close" autoFocus onClick={onClose}>
              閉じる
            </button>
          </>
        ) : (
          <>
            {hasFriends ? (
              <ul className="dest-list">
                {friends.map((name, i) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="btn dest-btn"
                      autoFocus={i === 0}
                      onClick={() => onPickFriend(name)}
                    >
                      <span className="chip" style={{ background: memberColor(members, name) }} />
                      <span className="dest-btn-label">{name} の島へ</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {showHome ? (
              <div className={hasFriends ? 'dest-home has-divider' : 'dest-home'}>
                <button type="button" className="btn dest-btn" autoFocus={!hasFriends} onClick={onPickHome}>
                  <span className="chip" style={{ background: memberColor(members, currentUser) }} />
                  <span className="dest-btn-label">◀ 自分の島に戻る</span>
                </button>
              </div>
            ) : null}

            <button type="button" className="link-btn dest-cancel" onClick={onClose}>
              やめる
            </button>
          </>
        )}
      </section>
    </div>
  );
};
