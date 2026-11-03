/**
 * 管理機能（家計簿・筋トレ・勉強・NISA …）をインポートで差し込むための型。
 *
 * 新しい管理機能を足すときは、`ManagementModule` を 1 つ作って `registry.ts` の `MANAGEMENT_MODULES` に足すだけ。
 * 下部バーの「管理機能」リスト、画面右のパネル、島の達成判定（黄金郷などのテーマ）、達成した月の降り注ぐ演出、
 * BGM（management）と SE（management）は、App がこの登録表から自動でつなぐ。
 *
 * 例：
 * ```tsx
 * export const trainingModule: ManagementModule = {
 *   id: 'training',
 *   label: '筋トレ',
 *   icon: IconTraining,
 *   useRuntime: (currentUser) => {
 *     const store = useTrainingStore(currentUser);           // 読み込み・保存はモジュールの中で持つ
 *     return {
 *       ready: store.ready,
 *       error: store.error,
 *       isAchieved: (owner, year, month) => store.countOf(owner, year, month) >= store.goalOf(owner, year, month),
 *       renderPanel: (props) => <TrainingPanel {...props} store={store} />,
 *     };
 *   },
 *   Celebration: TrainingRain,  // <CelebrationRain objects={ダンベルの群} active={active} /> を返すだけの部品
 * };
 * ```
 */
import type { ComponentType, ReactNode } from 'react';
import type { IconComponent } from '../components/hud/icons';
import type { IslandTheme } from '../types/ledger';

/** 画面右のパネルに渡すもの。月送りと閉じるは App が持つ */
export interface ManagementPanelProps {
  year: number;
  month: number;
  currentUser: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onClose: () => void;
}

/** モジュールの hook が毎レンダー返すもの */
export interface ManagementRuntime {
  /** 初回の読み込みが終わるまで false。全モジュールが ready になるまで App は「読み込んでいます」 */
  ready: boolean;
  /** 読み込みに失敗したときのメッセージ。成功時は null */
  error: string | null;
  /** owner（島の持ち主）のその月が目標を達成しているか。目標が無い月は false */
  isAchieved: (owner: string, year: number, month: number) => boolean;
  /** パネルの中身。毎回同じコンポーネントを返し、データは props で渡す（入力中のフォームが消えないように） */
  renderPanel: (props: ManagementPanelProps) => ReactNode;
}

/** 3D の島の上で、達成した月に降らせる演出。`active` の切り替えでフェードイン・アウトする */
export interface CelebrationProps {
  active: boolean;
}

export interface ManagementModule {
  /** 一意な id。ViewState の `module` と下部バーのリストに使う */
  id: string;
  label: string;
  icon: IconComponent;
  /** 読み込み・保存を持つ React hook。App が毎レンダー同じ順で呼ぶ。省略すると下部バーで「準備中」になる */
  useRuntime?: (currentUser: string | null) => ManagementRuntime;
  /** 達成した月の島のテーマ。省略すると島は変えない（演出だけ） */
  achievedTheme?: IslandTheme;
  /** 達成した月に降らせる演出（`CelebrationRain` を包んだ部品）。省略すると降らせない */
  Celebration?: ComponentType<CelebrationProps>;
}
