/**
 * 管理内容プラグイン（plugins/<id>/plugin.json）の型。
 * 書式の正は plugins/README.md と server/plugins.py の検証。
 */

export type PluginFieldType =
  | 'text'
  | 'number'
  | 'integer'
  | 'select'
  | 'tags'
  | 'boolean'
  | 'date'
  | 'place';

export interface PluginFieldOption {
  value: string;
  label: string;
}

export interface PluginField {
  key: string;
  type: PluginFieldType;
  label: string;
  required?: boolean;
  /** select のとき必須 */
  options?: PluginFieldOption[];
  min?: number;
  max?: number;
  unit?: string;
}

export type MetricAggregate = 'sum' | 'count' | 'max' | 'min' | 'avg' | 'latest';

/** select の項目がこのどれかの記録 */
export interface SelectRule {
  field: string;
  values: string[];
}

export interface PluginMetric {
  key: string;
  label: string;
  agg: MetricAggregate;
  /** count 以外は必須。数値の項目 key */
  field?: string;
  unit?: string;
  /** select の値がこのどれかなら符号を反転（支出を引く等） */
  negateWhen?: SelectRule;
  /** この条件に合う記録だけを集計する（成長投資枠だけ、数学だけ等） */
  where?: SelectRule;
}

/** ボクセルの絵。layers は下→上、各層は奥→手前の行、各行の 1 文字が 1 ボクセル（'.' は空） */
export interface VoxelModel {
  palette: Record<string, string>;
  layers: string[][];
  /** 自ら光る（ネオン） */
  glow?: boolean;
}

export type SpriteZone = 'sea' | 'sky' | 'shore' | 'rooftop';
export type SpriteMotion = 'orbit' | 'jump' | 'bob' | 'hop' | 'pump';

export interface EffectSprite {
  model: VoxelModel;
  count: number;
  zone: SpriteZone;
  motion: SpriteMotion;
  /** 1 ボクセルの大きさ（ワールド単位） */
  size: number;
  speed?: number;
}

/** 目標達成エフェクトで島に重ねるもの */
export interface EffectScene {
  /** 空の色。指定すると CSS の空を塗りつぶす */
  sky?: string;
  /** 遠景の霧の色 */
  horizon?: string;
  /** 環境光の色 */
  ambient?: string;
  sprites?: EffectSprite[];
}

export interface PluginEffect {
  id: string;
  /** 0〜1。到達した中で最大の minProgress のエフェクトを使う */
  minProgress: number;
  /** 島の土台（lib/effects.ts の EFFECT_THEMES） */
  theme: string;
  scene?: EffectScene;
}

export interface PluginManifest {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  fields: PluginField[];
  metrics: PluginMetric[];
  goal: { metric: string; op: '>=' | '<=' };
  effects: PluginEffect[];
}

export type PluginData = Record<string, string | number | boolean | string[]>;

export interface PluginEntry {
  id: string;
  pluginId: string;
  groupId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  data: PluginData;
  owners: string[];
}

export interface PluginGoal {
  id: string;
  pluginId: string;
  groupId: string;
  metric: string;
  label: string;
  /** 期間は任意。'YYYY-MM-DD' 両端を含む */
  start: string;
  end: string;
  target: number;
}

export interface PluginGroup {
  id: string;
  pluginId: string;
  name: string;
  members: string[];
}

/** ある日 at の時点で見せる目標と進捗（server/plugins.py の goal_status と同じ計算） */
export interface PluginStatus {
  at: string;
  goal: PluginGoal | null;
  value: number | null;
  /** 0〜1 */
  progress: number;
  achieved: boolean;
  /** 目標期間が at までに終わっているか */
  finished: boolean;
  /** effects[].id のどれか */
  effect: string;
}

export interface PluginState {
  manifest: PluginManifest;
  group: PluginGroup;
  entries: PluginEntry[];
  goals: PluginGoal[];
}

/** 切り替え用の一覧に出す情報 */
export interface PluginSummary {
  id: string;
  name: string;
}
