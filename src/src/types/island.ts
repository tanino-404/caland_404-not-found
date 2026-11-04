import type { ComponentType } from 'react';
import type { Material } from 'three';
import type { EventCategory } from './calendar';
import type { DayPhase } from './weather';

/**
 * 島の見た目。いつもの島（草・土・石・雪）は null で表し、目標達成で変わる島はプラグインが描く。
 * プラグインは plugins/<id>/island.tsx で `islands`（名前 → IslandDefinition）を export し、
 * plugin.json の islands に名前を書く。画面は lib/islands.ts がインストール済みのものだけを読み込む。
 */

/** 塔の 1 ブロックの材質。BoxGeometry の面順（+x, -x, +y, -y, +z, -z）で 6 枚、または 1 枚 */
export type BlockMaterial = Material | Material[];

/** 中央の島の大きな飾り（Decor）に渡すもの */
export interface IslandDecorProps {
  /** 月の行数（4〜6）。島の奥は z = -rows / 2、手前は z = rows / 2 */
  rows: number;
  /** 日ビュー（1 日に寄っている）か。島の奥の大きな建物はこのとき出さない */
  dayView: boolean;
  /** いちばん高い塔（予定 3 件以上）。無ければ null。目印を載せるのに使う */
  tallest: { x: number; z: number; top: number } | null;
}

/** 達成した月に入る / 出るときにフェードする空の演出（Fx）に渡すもの */
export interface IslandFxProps {
  /** この島の月か。切り替えで 1 秒かけてフェードイン・アウトする */
  active: boolean;
  /** 画面全体に出るレンズフレアを付けるか。カルーセルの中央の島だけ true */
  flare: boolean;
}

/** 予定のある塔の屋上に足すもの（Rooftop）に渡すもの */
export interface IslandRooftopProps {
  dateKey: string;
  /** その日の予定数 */
  count: number;
  /** 塔の天面の高さ */
  y: number;
}

export interface IslandDefinition {
  /** 年ビューのツールチップに出す島の名前 */
  label: string;
  /** 月ビューの凡例。予定の種類の呼び名と、島の説明。無ければいつもの凡例 */
  legend?: { categoryLabels: Record<EventCategory, string>; description: string };
  /** 塔のブロック。level 0 は海に接する縁、isTop は最上段（白い日付の数字が載る）。無ければいつもの草・土・石・雪 */
  blocks?: (level: number, isTop: boolean) => BlockMaterial;
  /** 年ビューの島も blocks で描くか */
  blocksInYear?: boolean;
  /** 予定の無い日の水ブロックの質感 */
  water?: { color: string; roughness: number; metalness: number; opacity: number };
  /** 塔の上を歩く村人の服の色 */
  villagers?: { shirts: readonly string[]; pants: readonly string[] };
  /** 時刻帯ごとの地平（fog と空の下端）の色 */
  horizon?: Partial<Record<DayPhase, string>>;
  /** ライトを足す（黄金郷の金の光など）。時刻帯を受け取る */
  Lights?: ComponentType<{ dayPhase: DayPhase }>;
  /** 中央の島だけに付ける大きな飾り */
  Decor?: ComponentType<IslandDecorProps>;
  /** 月を送ると 1 秒でフェードする空の演出。カルーセルの 3 島すべてに付く */
  Fx?: ComponentType<IslandFxProps>;
  /** 予定のある塔の屋上に足すもの */
  Rooftop?: ComponentType<IslandRooftopProps>;
}

/** plugins/<id>/island.tsx が export するもの */
export interface IslandModule {
  islands: Record<string, IslandDefinition>;
}

/** 読み込んだ島。key は「<プラグイン id>/<島の名前>」。body と .app に is-island と is-<name> のクラスが付く */
export interface Island extends IslandDefinition {
  key: string;
  pluginId: string;
  name: string;
}
