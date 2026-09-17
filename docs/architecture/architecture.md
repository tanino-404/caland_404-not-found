# アーキテクチャ

技術スタック・画面構成・`src/` 配下の構造をここに集約する。
「技術スタック」は開発開始前に `docs/human_idea/` をもとに AI が決定して記入する。それ以外は骨組みを作った後に記入する。

対象アプリ：**予定の混み具合マップ** — カレンダーの予定を、マイクラ風ブロックの山と小さな町として 3D で俯瞰する（`docs/human_idea/concept.md`）。

## 技術スタック

- 種別：**フロントのみ**（バックエンドなし。共有カレンダーの状態は `localStorage` に保存し、同じブラウザ内でメンバーを切り替えて共同編集する）
- 言語・フレームワーク：**Vite 8 + React 19 + TypeScript**（テンプレート `react-ts`）
  - 3D 描画：**three.js 0.186** + **@react-three/fiber 9**（React 19 とペア）+ **@react-three/drei 10**（`OrbitControls`）
  - 2D ヒートマップ：ライブラリなし。CSS Grid の `button` で描く
  - スタイル：素の CSS（`src/src/styles/global.css`）。UI ライブラリは入れない。書体は DotGothic16（日本語ドット体、OFL）を `src/public/fonts/` に同梱し `@font-face` で読む。ネットワーク不要
  - 3D モデル：外部アセット（glb 等）は使わない。`boxGeometry` を組み合わせた **ボクセル（ドット風）モデルをコードで生成** する。ローダー不要・アセット管理不要・見た目がマイクラ風で揃う
  - 3D 内の文字（日付・曜日）：フォントを使わず **3×5 ピクセルフォント**（`lib/pixelFont.ts`）を `InstancedMesh` 1 つで描く
  - リンター：oxlint（Vite 8 の `react-ts` テンプレート既定）
- 初期化コマンド（実施済み。`src/` が Vite プロジェクトルート）：

  ```bash
  npm create vite@latest src -- --template react-ts
  cd src
  npm install react@~19.2.8 react-dom@~19.2.8   # fiber 9.7 の peer 条件が react <19.3 のため 19.2 系に固定
  npm install three @react-three/fiber @react-three/drei
  npm install -D @types/three
  ```

- 起動コマンド：`cd src && npm run dev`（`http://localhost:5173`）
- 型チェック・リンター・ビルド：`cd src && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build`
- 外部 API・秘密情報：**不要**。予定データは `src/src/data/sampleEvents.ts` の固定サンプル（一年分。シード固定の決定的生成）を初期値とし、以後は `localStorage` に保存した状態を使う。Google カレンダー連携は「あれば嬉しい機能」で未着手
- ログイン：**ユーザー名だけ**（パスワードなし、サーバーなし）。メンバー一覧・現在のユーザー・予定はすべて `localStorage` の 1 キー（`schedule-terrain-map`、`version` 付き）に保存する。バージョンが違う保存データは捨ててサンプルから作り直す
- 動作確認ブラウザ：Cursor 内蔵ブラウザ（WebGL 必須）
- 迷ったときの既定：フロントのみ、Vite + React + TypeScript（`npm create vite@latest src -- --template react-ts`）。
  バックエンドが不要な構成を選び、状態はブラウザ内（メモリ / localStorage）で持つ。

### 採用理由（短く）

- 「目を引く 3D」が評価軸の最優先。React Three Fiber は React の状態管理でシーンを組めるため、ビュー切替（年 → 月 → 日）とカメラ演出を React state だけで扱える
- バックエンド・外部 API を持たないことで、デモ当日のネットワークや認証トラブルをゼロにする
- ボクセルをコード生成にすることで、3D モデル担当と画面担当が **別ファイルで並列作業** できる（§3.2 コンフリクト回避）

## 画面・構成の概要

単一ページ。`App` が `view` state を持ち、3 つのビューを切り替える。ブラウザのルーティングは使わない。

```
year（2D ヒートマップ） ──月をクリック──▶ month（3D 月俯瞰） ──日をクリック──▶ day（3D 日ズーム）
        ◀────────「年に戻る」────────────       ◀────────「月に戻る」────────────
```

### 1. 月ビュー `month`（MVP の主役・デモの最初に見せる）

- 3D シーン。カレンダーグリッドは **横 7 列（Sun〜Sat）× 縦 週数（4〜6 行）**。1 日 = 1 マス（幅 1 の正方形）
- カメラは斜め上からの三人称俯瞰（初期位置：グリッド中心から見て手前・上方。`OrbitControls` で回転・ズーム可）
- 各日の表現（`DayTower`）：
  - 地面：予定 1 件以上の日は島の縁ブロック 1 個（側面は砂浜、天面は草）。**予定 0 件の日は海**（半透明の水ブロックが揺れ、日付は水面に寝かせて置く）。全体の海面は `Sea.tsx`
  - 積み上げ：予定数 n の分だけブロックを積む（土 → 石 → 雪 のように高さで質感を変えると「山」に見える）
  - 屋上：最上段ブロックの上に、その日の予定カテゴリに対応した **ボクセル建物** を 3×3 のグリッドに並べる。配置順は日付をシードに決定的にシャッフルし、微小なずれ（jitter）を加えて町らしく見せる。各カテゴリは 3 バリエーション（`Xxx.tsx` / `Xxx2.tsx` / `Xxx3.tsx`）からスロット座標で決定的に選ぶ。最大 9 個。10 個以上は日ビューの HUD に「あと N 件」と出す
  - 村人（`Villagers.tsx`）：せり上がりが終わったあと、島の上に小さな人が歩く
  - 最上段ブロックの手前の面に日付数字（ピクセルフォント。雪頂上は濃紺、それ以外はクリーム色）
  - 月を切り替えるとタワーが日付順に地面から伸び上がる（読み込み時の 1 演出）
- 曜日ヘッダー（SUN〜SAT）はグリッド奥の木の看板として 3D 内に置く。月名・件数は HUD の左上（巨大な月数字がヒーロー）
- HUD（2D オーバーレイ）：前月 / 次月ボタン（左下）、「一年を見る」（右上）、カテゴリ凡例（右下）、ホバー中の日付と件数（下中央）
- 日マスをホバー → 金色の半透明ハイライト。クリック → `day` ビューへ

### 2. 日ビュー `day`（ズームイン）

- 同じ 3D シーンのまま、カメラだけをクリックした日の **最上段ブロックの真上付近** へ補間移動（`useFrame` で位置と注視点を lerp）。シーンを作り直さないので遷移が滑らか
- `OrbitControls` の `target` をその日のタワー頂点にし、ユーザーは町を回して眺められる
- HUD：日付・予定タイトル一覧（カテゴリアイコン付き）、「月に戻る」ボタン
- 「月に戻る」→ カメラが月俯瞰位置へ補間で戻る

### 3. 年ビュー `year`（2D ヒートマップ）

- 12 か月を「島」のカード（`YearHeatmap.tsx` + `YearIslands.css`）として 2 列で並べる。各カードに月名・件数・最高峰と、その月の 7 列 × 週数のミニマップ（海の上に島）
- ミニマップの色は予定数 0〜6+ の 7 段階（`blockKinds.ts` の `ELEVATION_COLORS`）。0 件は海、以降は 3D 側のブロック色（土 → 石 → 雪）と揃えて世界観をつなげる
- 島カードをクリック → その月の `month` ビューへ
- 初期版は 2D 固定（concept.md の指示どおり）

### 4. ログインと共有（あれば嬉しい機能 1）

- 未ログイン時は `month` ビューの 3D を背景にしたまま `LoginScreen` を重ねる。既存メンバーはワンクリック、新しい名前は入力で参加。「保存したデータを消してサンプルに戻す」もここに置く
- メンバーごとに識別色（`lib/members.ts` の `MEMBER_PALETTE`、登録順）。HUD 右上に現在のユーザーとログアウト、凡例にメンバー色と「みんなの予定」（全員の色の縦縞）
- **ホバー / 選択中のタワーでは、屋上の各建物が少し浮き、足元に所有者色の台座（`OwnerPlate`）が出る**。2 人以上で共有する予定は台座を人数ぶんの縦縞に分割し、全員の色を見せる。ツールチップにも「たろう 3 · はなこ 4 · みんな 2」の内訳を出す
- 日ビューの `DayHud`：各予定に所有者チップ（共有は 2 色）と所有者名。自分の予定でないものには「参加する」（自分を所有者に追加 → 共有の予定になる）。自分の予定には「削除」（1 人の予定なら消える。共有の予定なら「抜ける」になり、自分だけ所有者から外れて相手の予定として残る）。下部のフォームでタイトル・種類（8 種の建物チップ）を選び、「誘う」で他のメンバーにチェックを入れて「建てる」と、自分＋誘った人の共有の予定として 1 件追加される（例：たろうがはなこを誘う → 所有者 [たろう, はなこ]。両者のカレンダーに同じ予定が入る）。誘わなければ自分だけの予定
- 状態管理は `hooks/useSharedCalendar.ts` の 1 か所。`login` / `logout` / `addEvent` / `joinEvent` / `removeEvent` / `resetToSample` の各アクション内で保存する（effect での保存はしない）
- **島の並べ方（`IslandLayout`）は 2 通り**。HUD 右上のボタンで切り替える（メンバーが 2 人以上のときだけ有効）
  - `merged`（既定）「ひとつの島」：メンバー全員の予定を 1 つの島に建てる。持ち主はホバーの台座で見分ける（上記）
  - `split`「ふたりの島」：手前に自分の島（自分が所有者の予定）、海を挟んで奥に相方の島（相方が所有者の予定）を並べる。**ふたりが所有者の予定がある日は、塔と塔の間をハートの旗を曳く飛行機（`Flight.tsx`）が往復する**。相方は自分以外の先頭メンバー。3 人以上いるときは凡例の「奥の島：」チップで選ぶ。奥の島は飾り（ホバー・クリック不可）。両島のデータは同じ共有カレンダーから `owners` で振り分ける（`lib/members.ts` の `eventsOwnedBy` / `datesSharedBetween`）ので、片方で「誘う」や「参加する」をすると即座に両島と飛行機に反映される
  - 日ビューの HUD は並べ方に関係なく全員の予定を出す（相方の予定に参加できるようにするため）

### 初期表示

`month` ビュー、データの中で最も予定が多い月から開始する（デモの一言コンセプトを最初の 1 画面で伝えるため）。未ログインならその上にログイン画面。

## データモデル

```ts
// src/src/types/calendar.ts
export type EventCategory =
  | 'beauty'      // 美容室
  | 'restaurant'  // 飲食店
  | 'work'        // 仕事・会議
  | 'wedding'     // 結婚式
  | 'hospital'    // 病院
  | 'gym'         // ジム
  | 'travel'      // 旅行
  | 'school';     // 学校・習い事

export interface CalendarEvent {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  title: string;
  category: EventCategory;
  owners: string[];      // 所有するメンバー名（1 人以上）。2 人以上なら共有の予定
}

export type ViewState =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }               // month: 1-12
  | { kind: 'day'; year: number; month: number; day: number };
```

- カテゴリ → ボクセル建物コンポーネントの対応表を `components/models/objects/index.ts` に 1 か所で持つ（新カテゴリ追加は「型に 1 行 + 対応表に 1 行 + 建物ファイル 1 つ」）
- 日別集計は `lib/calendar.ts` の純関数で行う（`groupEventsByDate`、`buildMonthGrid`）。React 側は計算しない

## 3D 表現の規約

- 単位：1 マス = 1 × 1（`CELL_SIZE`）。タワーの幅は 0.92（`TOWER_WIDTH`。隙間が路地になる）、ブロックの高さは 0.5（`BLOCK_HEIGHT`）。グリッドは原点中心に置き、x = 曜日（`colToX`）、z = 週（`rowToZ`）、y = 高さ。変換は `lib/camera.ts` に集約
- ブロックの質感は高さ（level）で決める：0 = 草の地面、1〜2 = 土（天面なら草）、3〜5 = 石、6 以上 = 雪（`blockKindForLevel`）
- ブロックは `BoxGeometry` + `MeshStandardMaterial` の 6 面配列（フラットな単色。テクスチャ画像は使わない）。材質はモジュール定数として共有する
- 建物モデルは **1 ファイル 1 建物**、`export const Salon = ({ position }: ObjectProps) => …` 形式。中身は `Voxel`（位置・サイズ・色）を `<group>` で束ねた、底面 0.26 × 0.26・高さ 0.45 以内のボクセル（3×3・ピッチ 0.29 に収めるため）。色→材質は `materialFor` でキャッシュして共有する
- ライト：`ambientLight` + 影付き `directionalLight` 1 灯。背景は CSS の空色グラデーション（Canvas は透過）、地面の下に海面（青い平面）、遠景に `fog`（水平線色）で「島の地図」感を出す
- インタラクション：`onPointerOver` / `onClick` はタワーの `group` で受け、`stopPropagation` で手前のタワーだけ反応させる。ハイライトは金色の半透明ボックスをタワーに重ねる（材質の複製は作らない）。ホバーでカーソルを pointer に
- カメラ：`CameraRig` が `pose` の変化を検知して `camera.position` と `OrbitControls.target` を指数補間で寄せ、到着したら補間を止めてユーザー操作に任せる
- パフォーマンス：1 か月分は 31 日 × 最大 11 段 + 建物 ≒ 数百〜千 mesh で問題ない。日付ラベルのピクセルだけは `InstancedMesh` 1 描画にまとめる。年 3D 化（将来）の段階でブロックの `InstancedMesh` 化を検討する

## 固定データ（デモ用）

- `src/src/data/sampleEvents.ts`：対象年 1 年分の予定。月ごとに山谷がはっきり出るよう、**繁忙月（例：3 月・12 月）と閑散月（例：8 月）** を意図的に作る。デモで最初に見せる月には 1 日に 8〜10 件入る日を置き、「高い塔の上の小さな町」が成立するようにする
- ファイル名・変数名で固定データと分かるようにする（`sampleEvents`）

## src/ 配下の構造（骨組みを作った後に最新化する。以下は設計時の案）

```
src/                               ← Vite プロジェクトルート
├─ index.html
├─ package.json                    ← 共有ファイル（§3.2）
├─ vite.config.ts                  ← 共有ファイル
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json ← 共有ファイル
├─ .oxlintrc.json                  ← 共有ファイル（リンター設定）
├─ public/
│   ├─ favicon.svg
│   └─ fonts/DotGothic16-Regular.ttf, OFL.txt ← 同梱フォントとライセンス
└─ src/
   ├─ main.tsx                     ← エントリポイント（共有ファイル）
   ├─ App.tsx                      ← ViewState を持ち、Year / Month シーンと HUD を切り替える（共有ファイル）
   ├─ types/
   │   └─ calendar.ts              ← CalendarEvent / EventCategory / ViewState / CATEGORY_INFO（色・表示名）
   ├─ data/
   │   └─ sampleEvents.ts          ← 固定データ：2026 年一年分のサンプル予定（シード固定生成）
   ├─ lib/
   │   ├─ calendar.ts              ← 月グリッド計算・日別集計・最繁忙月・日付表記（純関数）
   │   ├─ camera.ts                ← グリッド座標 ⇄ ワールド座標、月俯瞰（1 島 / 2 島）/ 日ズームのカメラ姿勢、相方の島の z オフセット
   │   ├─ pixelFont.ts             ← 3×5 ピクセルフォント（数字と SUN〜SAT に必要な英字）
   │   ├─ members.ts               ← メンバー識別色、所有者チップの背景、所有者別の件数内訳、島ごとの予定の振り分け
   │   └─ storage.ts               ← localStorage の読み書き（version 付き 1 キー）
   ├─ hooks/
   │   └─ useSharedCalendar.ts     ← 共有カレンダーの状態とアクション（login / addEvent / joinEvent …）
   ├─ components/
   │   ├─ year/
   │   │   └─ YearHeatmap.tsx      ← 2D ヒートマップ（53 週 × 7 曜日の CSS Grid、月ラベル、標高凡例）
   │   ├─ month/
   │   │   ├─ MonthScene.tsx       ← <Canvas>、ライト、fog、海面、OrbitControls、DayTower と日付ラベルの配置（split なら相方の島と飛行機も）
   │   │   ├─ Flight.tsx           ← ふたりの予定の日に島と島を往復するボクセル飛行機（ハートの旗）
   │   │   ├─ DayTower.tsx         ← 1 日分：地面 + 積みブロック + 屋上 3×3 の建物 + ハイライト + 出現アニメ
   │   │   ├─ PixelLabels.tsx      ← ピクセル文字を 1 つの InstancedMesh で描く
   │   │   ├─ WeekdayHeader.tsx    ← グリッド奥の木の看板（SUN〜SAT）
   │   │   └─ CameraRig.tsx        ← pose が変わるたびにカメラを補間移動、到着後はユーザー操作に任せる
   │   ├─ models/
   │   │   ├─ materials.ts         ← 共有 BoxGeometry と色 → MeshStandardMaterial のキャッシュ
   │   │   ├─ Voxel.tsx            ← 建物を組む最小単位（位置・サイズ・色）
   │   │   ├─ OwnerPlate.tsx       ← 建物の足元の「縁取り」台座。所有者色、共有なら縦縞
   │   │   ├─ blocks/
   │   │   │   ├─ blockKinds.ts    ← ブロック種別・色・高さ→種別の規則・ヒートマップの標高色
   │   │   │   └─ Block.tsx        ← 積む用ブロック 1 個（草 / 土 / 石 / 雪の 6 面マテリアル）
   │   │   └─ objects/             ← 屋上に並べる建物（1 ファイル 1 種）
   │   │       ├─ types.ts         ← ObjectProps
   │   │       ├─ index.ts         ← EventCategory → コンポーネント対応表
   │   │       ├─ Salon.tsx        ← 美容室
   │   │       ├─ Restaurant.tsx   ← 飲食
   │   │       ├─ Office.tsx       ← 仕事
   │   │       ├─ Church.tsx       ← 結婚式（Petals を含む）
   │   │       ├─ Petals.tsx       ← 頂上から舞い落ちる花びら（useFrame で 12 粒を周回）
   │   │       ├─ Hospital.tsx     ← 病院
   │   │       ├─ Gym.tsx          ← ジム
   │   │       ├─ Airplane.tsx     ← 旅行
   │   │       └─ School.tsx       ← 学校
   │   └─ hud/
   │       ├─ LoginScreen.tsx      ← ユーザー名だけのログイン、既存メンバーのワンクリック、サンプルに戻す
   │       ├─ MonthHud.tsx         ← 月名・前後月・年ビューへ・現在のユーザー・凡例・ホバーの日付と所有者内訳
   │       └─ DayHud.tsx           ← 日付・予定一覧（所有者チップ・参加する/削除/抜ける）・予定を建てるフォーム（種類チップ・誘う）・月に戻る
   └─ styles/
       └─ global.css               ← デザイントークン、HUD（看板風パネル）、ヒートマップ、レスポンシブ
```

### UI のデザイントークン（`global.css` の `:root`）

- 色：インク `#1b2a41`、紙 `#fff8e7`、古紙 `#f3e2b6`、金 `#ffc83d`、草 `#5fb63b`、空 `#5cb0ff → #cfeeff`
- 書体：DotGothic16 一系統。ヒーローは左上の巨大な月数字
- パネル・ボタン：3px のインク枠 + 硬い落ち影（角丸なし）。ピクセルゲームの看板の語彙で、3D の町を邪魔しない
- ヒートマップの色は 3D ブロックと同じ「標高」スケール（草 → 土 → 石 → 雪）

### 並列作業の分担単位（コンフリクト回避）

同時に触らないよう、次の単位で分けて着手する。

| 単位 | ファイル |
| --- | --- |
| A. シーンとカメラ | `components/month/**` / `lib/camera.ts` / `lib/pixelFont.ts` |
| B. ブロック・建物モデル | `components/models/**` |
| C. データと集計・年ビュー | `data/sampleEvents.ts` / `lib/calendar.ts` / `components/year/**` |
| D. HUD とスタイル | `components/hud/**` / `styles/global.css` |
| E. ログイン・共有の状態 | `hooks/useSharedCalendar.ts` / `lib/storage.ts` / `lib/members.ts` |
| 共有（声をかけてから） | `App.tsx` / `main.tsx` / `types/calendar.ts` / `package.json` 等の設定ファイル |
