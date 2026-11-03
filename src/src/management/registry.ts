import { IconNisa, IconStudy, IconTraining } from '../components/hud/icons';
import type { IslandTheme } from '../types/ledger';
import { ledgerModule } from './ledgerModule';
import type { ManagementModule, ManagementRuntime } from './types';

/**
 * 管理機能の登録表。下部バーの「管理機能」リストはこの順に並ぶ。
 * `useRuntime` の無いものは「準備中」として並ぶだけ（サンドボックス化でインポートされたら差し替える）
 */
export const MANAGEMENT_MODULES: readonly ManagementModule[] = [
  ledgerModule,
  { id: 'training', label: '筋トレ', icon: IconTraining },
  { id: 'study', label: '勉強', icon: IconStudy },
  { id: 'nisa', label: 'NISA', icon: IconNisa },
];

/** 使えるモジュール（`useRuntime` を持つもの）。登録表は固定なので、この順で毎レンダー hook を呼んでよい */
const ACTIVE_MODULES = MANAGEMENT_MODULES.filter(
  (entry): entry is ManagementModule & { useRuntime: NonNullable<ManagementModule['useRuntime']> } =>
    entry.useRuntime !== undefined,
);

export interface ManagementState {
  /** モジュール id → そのレンダーの runtime */
  runtimes: ReadonlyMap<string, ManagementRuntime>;
  ready: boolean;
  error: string | null;
  /** owner のその月に達成しているモジュールの id */
  achievedOf: (owner: string, year: number, month: number) => ReadonlySet<string>;
  /** owner のその月の島のテーマ。達成したモジュールの `achievedTheme`（無ければ plain） */
  themeOf: (owner: string, year: number, month: number) => IslandTheme;
}

/** 登録表の全モジュールの hook を、固定の順で呼ぶ */
export const useManagement = (currentUser: string | null): ManagementState => {
  const runtimes = new Map<string, ManagementRuntime>();
  for (const entry of ACTIVE_MODULES) {
    runtimes.set(entry.id, entry.useRuntime(currentUser));
  }
  const all = [...runtimes.values()];
  const achievedOf = (owner: string, year: number, month: number): ReadonlySet<string> => {
    const ids = new Set<string>();
    for (const [id, runtime] of runtimes) {
      if (runtime.isAchieved(owner, year, month)) ids.add(id);
    }
    return ids;
  };
  const themeOf = (owner: string, year: number, month: number): IslandTheme => {
    const achieved = achievedOf(owner, year, month);
    for (const entry of ACTIVE_MODULES) {
      if (entry.achievedTheme !== undefined && achieved.has(entry.id)) return entry.achievedTheme;
    }
    return 'plain';
  };
  return {
    runtimes,
    ready: all.every((runtime) => runtime.ready),
    error: all.find((runtime) => runtime.error !== null)?.error ?? null,
    achievedOf,
    themeOf,
  };
};

export const findModule = (id: string): ManagementModule => {
  const entry = MANAGEMENT_MODULES.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`findModule: 登録されていない管理機能です: ${id}`);
  }
  return entry;
};
