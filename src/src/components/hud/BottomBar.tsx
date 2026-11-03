import { useEffect, useRef, useState } from 'react';
import {
  type IconComponent,
  IconFriend,
  IconLogout,
  IconManage,
  IconMonth,
  IconSettings,
  IconYear,
} from './icons';
import './BottomBar.css';

export interface BottomBarProps {
  /** スロット 1 を押したときに切り替わる先。ボタンにはこの先を描く */
  calendarTarget: 'year' | 'month';
  /** 友達の島にいるとき true：スロット 1 の機能タイトルを「友達の年間」「友達の月間」にする */
  friendCalendar: boolean;
  /** 今いる表示に対応するスロットを点灯。null なら点灯なし */
  active: 'calendar' | 'friend' | 'manage' | null;
  /** スロット 1（年/月カレンダー）を出すか。友達の島では false */
  showCalendar: boolean;
  /** スロット 3（管理機能）を出すか。友達の島では false */
  showManage: boolean;
  onShowCalendar: () => void;
  /** 自分以外のメンバーがいないとき true */
  friendDisabled: boolean;
  onVisitFriend: () => void;
  /** 「管理機能」リストに並べるもの（管理プラグインの一覧から App が作る） */
  manageItems: readonly ManageMenuItem[];
  /** 選んだプラグインを表示中にして、入力パネルを開く */
  onOpenManage: (id: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

/** 「管理機能」リストの 1 行 */
export interface ManageMenuItem {
  id: string;
  label: string;
  icon: IconComponent;
  /** 島のテーマを決めている（表示中の）プラグインなら true */
  selected: boolean;
}

const MANAGE_MENU_ID = 'hotbar-manage-menu';

interface SlotProps {
  title: string;
  icon: IconComponent;
  active: boolean;
  disabled?: boolean;
  /** disabled のときにツールチップへ出す文言。未指定なら title */
  disabledTitle?: string;
  onClick: () => void;
}

/** ホットバーの 1 マス。ツールチップは CSS（hover / focus-visible）で出す */
const Slot = ({ title, icon: Icon, active, disabled = false, disabledTitle, onClick }: SlotProps) => {
  const tip = disabled && disabledTitle !== undefined ? disabledTitle : title;
  const className = ['hotbar-slot', active ? 'is-active' : '', disabled ? 'is-disabled' : '']
    .filter((name) => name.length > 0)
    .join(' ');
  return (
    <div className={className}>
      <button
        type="button"
        className="hotbar-btn"
        aria-label={tip}
        aria-current={active ? 'page' : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon size={40} />
      </button>
      <span className="hotbar-tip panel" role="tooltip">
        {tip}
      </span>
    </div>
  );
};

/** メイン画面の下中央に常時出す、マイクラのホットバー風メニュー */
export const BottomBar = ({
  calendarTarget,
  friendCalendar,
  active,
  showCalendar,
  showManage,
  onShowCalendar,
  friendDisabled,
  onVisitFriend,
  manageItems,
  onOpenManage,
  onOpenSettings,
  onLogout,
}: BottomBarProps) => {
  const [manageOpen, setManageOpen] = useState(false);
  const manageRef = useRef<HTMLDivElement>(null);
  const manageButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!manageOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (manageRef.current === null) return;
      if (e.target instanceof Node && manageRef.current.contains(e.target)) return;
      setManageOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setManageOpen(false);
      manageButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [manageOpen]);

  const pickManage = (id: string) => {
    setManageOpen(false);
    onOpenManage(id);
  };

  const manageClassName = [
    'hotbar-slot',
    active === 'manage' ? 'is-active' : '',
    manageOpen ? 'is-open' : '',
  ]
    .filter((name) => name.length > 0)
    .join(' ');

  return (
    <nav className="hotbar" aria-label="メニュー">
      {showCalendar ? (
        <Slot
          title={
            friendCalendar
              ? calendarTarget === 'year'
                ? '友達の年間'
                : '友達の月間'
              : calendarTarget === 'year'
                ? '年カレンダー'
                : '月カレンダー'
          }
          icon={calendarTarget === 'year' ? IconYear : IconMonth}
          active={active === 'calendar'}
          onClick={onShowCalendar}
        />
      ) : null}
      <Slot
        title="友達の島へ移動"
        icon={IconFriend}
        active={active === 'friend'}
        disabled={friendDisabled}
        disabledTitle="友達がまだいません"
        onClick={onVisitFriend}
      />

      {showManage ? (
        <div className={manageClassName} ref={manageRef}>
          {manageOpen ? (
          <ul className="hotbar-menu panel" id={MANAGE_MENU_ID} role="menu" aria-label="管理機能">
            {manageItems.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="hotbar-menu-item"
                    aria-current={feature.selected ? 'true' : undefined}
                    onClick={() => pickManage(feature.id)}
                  >
                    <Icon size={26} />
                    <span className="hotbar-menu-label">{feature.label}</span>
                    {feature.selected ? <span className="hotbar-menu-soon">表示中</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          ) : null}
          <button
            type="button"
            className="hotbar-btn"
            ref={manageButtonRef}
            aria-label="管理機能"
            aria-haspopup="menu"
            aria-expanded={manageOpen}
            aria-controls={manageOpen ? MANAGE_MENU_ID : undefined}
            aria-current={active === 'manage' ? 'page' : undefined}
            onClick={() => setManageOpen((open) => !open)}
          >
            <IconManage size={40} />
          </button>
          <span className="hotbar-tip panel" role="tooltip">
            管理機能
          </span>
        </div>
      ) : null}

      <Slot title="設定" icon={IconSettings} active={false} onClick={onOpenSettings} />
      <Slot title="ログアウト" icon={IconLogout} active={false} onClick={onLogout} />
    </nav>
  );
};
