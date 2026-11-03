# アーキテクチャ

技術スタック・画面構成・`src/` 配下の構造をここに集約する。
「技術スタック」は開発開始前に `docs/human_idea/` をもとに AI が決定して記入する。それ以外は骨組みを作った後に記入する。

対象アプリ：**予定の混み具合マップ** — カレンダーの予定を、マイクラ風ブロックの山と小さな町として 3D で俯瞰する（`docs/human_idea/concept.md`）。

## 技術スタック

- 種別：**フロント + このPCの予定・管理プラグインサーバー**（クラウドへは出さない。予定・メンバー・管理プラグインの記帳と月目標は、サーバーを動かしている1台の SQLite。ログイン中の名前だけ各ブラウザの `localStorage`。同じWi-Fiの人は、その1台の開発サーバーURLを開く。審査員のネットワークへは出さない）
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

- 起動コマンド：
  - 予定・管理プラグインサーバー：`cd server && source .venv/bin/activate && python app.py`（`http://127.0.0.1:8787`）
  - 画面：`cd src && npm run dev`（`http://localhost:5173`。`/api` は Vite が 8787 へ渡す）
- 型チェック・リンター・ビルド：`cd src && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build`
- サーバーの確認：`cd server && source .venv/bin/activate && python -m unittest discover -s tests -v`
- 外部 API・秘密情報：予定・管理プラグインは本機の 127.0.0.1:8787 だけ。画面の開発サーバーは同じWi-Fiからも開き、`/api` はそのPCの中で 8787 へ渡す。予定と管理データは `server/data/ledger.sqlite`。空の予定テーブルは起動時に `sampleEvents.ts` と同じシード（20260917）。空のプラグインは `server/plugins/<id>/sample.json` があればそれを入れる。同梱の家計簿（`ledger`）のサンプルは `sampleLedger.ts` と同じシード（20261014）。Google カレンダー連携は「あれば嬉しい機能」で未着手
- **持ち物提案**はサーバーが外部 API を順に呼ぶ（キーはフロントに出さない。`secret/.env`）。Overpass API（場所名→緯度経度と OSM タグ）→ YuMake 体感温度予報 API（降水量・風・気温・湿度・気圧・雲量・体感温度・WBGT・不快指数・風冷指数。最大 78 時間先）→ Claude API（持ち物と LINE 本文）→ LINE Messaging API（push）。Claude は HTTP の呼び出し役にはしない。キーをブラウザに出さず、場所検索と天気取得を止めずに失敗メッセージを出すため。今日明日天気 API と週間天気 API は地点コードが別に要り、体感指標が無いので使わない
- 管理プラグインバックエンド：**Python 3.11 標準ライブラリのみ**（`http.server` + `sqlite3`）。追加パッケージは入れない。仮想環境は `server/.venv`
- ログイン：**ユーザー名だけ**（パスワードなし）。メンバー一覧と予定は SQLite。今どの名前で入っているかだけ `localStorage` の 1 キー（`schedule-terrain-map`、`version` 4）に残す。バージョンが違う保存データは捨て、予定はサーバーのサンプルを読む
- 動作確認ブラウザ：Cursor 内蔵ブラウザ（WebGL 必須）
- 迷ったときの既定：フロントのみ、Vite + React + TypeScript（`npm create vite@latest src -- --template react-ts`）。
  バックエンドが不要な構成を選び、状態はブラウザ内（メモリ / localStorage）で持つ。

### 採用理由（短く）

- 「目を引く 3D」が評価軸の最優先。React Three Fiber は React の状態管理でシーンを組めるため、ビュー切替（年 → 月 → 日）とカメラ演出を React state だけで扱える
- 3D の月・日・年ビューは本機だけで回る。持ち物提案だけ、サーバーが Overpass / YuMake / Claude / LINE を順に呼ぶ（キーはフロントに出さない）
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
  - **管理プラグインの月目標を達成した月は、そのプラグインの effect**（`src/src/plugins/effects/index.ts`）。パネルを開いているプラグインが達成していればその effect。開いていなければ `GET /api/plugins` の並び順で最初に達成したもの。Scene は島の予定を覆わず、マイクラ風の Voxel で初めて見ても内容が分かる部品を島の周り（海・空）に置く。同梱の家計簿（`ledger`）は effect キー `luxury`（黄金郷）を指す。金の島、屋上のヤシ・プール・金の車、海のヨット、島の外周を降る金貨と札。勉強時間（`study`）は奥と左右の海に本棚と大きな本。どれも未達ならいつもの草・土・石・雪
  - 最上段ブロックの手前の面に日付数字（ピクセルフォント。雪頂上は濃紺、それ以外はクリーム色）
  - 月を切り替えるとタワーが日付順に地面から伸び上がる（読み込み時の 1 演出）
- 曜日ヘッダー（SUN〜SAT）はグリッド奥の木の看板として 3D 内に置く。月名・件数は HUD の左上（巨大な月数字がヒーロー）
- HUD（2D オーバーレイ）：前月 / 次月ボタン（左下）、「一年を見る」と管理プラグインのボタン（右上。表示はマニフェストのタイトル。同梱が家計簿だけなら「家計簿」1 つ）、カテゴリ凡例（右下）、ホバー中の日付と件数（下中央）。左上に各プラグインの今月の進捗 / 目標。パネルはマニフェストから入力欄を生成する
- 日マスをホバー → 金色の半透明ハイライト。クリック → `day` ビューへ

### 2. 日ビュー `day`（ズームイン）

- 同じ 3D シーンのまま、カメラだけをクリックした日の **最上段ブロックの真上付近** へ補間移動（`useFrame` で位置と注視点を lerp）。シーンを作り直さないので遷移が滑らか
- `OrbitControls` の `target` をその日のタワー頂点にし、ユーザーは町を回して眺められる
- HUD：日付・予定タイトル一覧（カテゴリアイコン付き、場所があれば表示）、「月に戻る」ボタン。予定を建てるときに場所（OpenStreetMap 上の名称、例：大阪城）を入れると、サーバーが場所と天気から持ち物を提案し LINE に送る。結果は同じパネルに出す。場所付きの既存予定は「持ち物を提案」で再実行できる
- 「月に戻る」→ カメラが月俯瞰位置へ補間で戻る

### 3. 年ビュー `year`（2D ヒートマップ）

- 12 か月を「島」のカード（`YearHeatmap.tsx` + `YearIslands.css`）として 2 列で並べる。各カードに月名・件数・最高峰と、その月の 7 列 × 週数のミニマップ（海の上に島）
- ミニマップの色は予定数 0〜6+ の 7 段階（`blockKinds.ts` の `ELEVATION_COLORS`）。0 件は海、以降は 3D 側のブロック色（土 → 石 → 雪）と揃えて世界観をつなげる
- 島カードをクリック → その月の `month` ビューへ
- 管理プラグインの目標を 1 つ以上達成した月のカードは金枠（ミニマップも金〜大理石〜金ガラス）。未達の月は通常の標高色
- 初期版は 2D 固定（concept.md の指示どおり）

### 4. ログインと共有（あれば嬉しい機能 1）

- 未ログイン時は `month` ビューの 3D を背景にしたまま `LoginScreen` を重ねる。既存メンバーはワンクリック、新しい名前は入力で参加。「保存したデータを消してサンプルに戻す」もここに置く
- メンバーごとに識別色（`lib/members.ts` の `MEMBER_PALETTE`、登録順）。HUD 右上に現在のユーザーとログアウト、凡例にメンバー色と「みんなの予定」（全員の色の縦縞）
- **ホバー / 選択中のタワーでは、屋上の各建物が少し浮き、足元に所有者色の台座（`OwnerPlate`）が出る**。2 人以上で共有する予定は台座を人数ぶんの縦縞に分割し、全員の色を見せる。ツールチップにも「たろう 3 · はなこ 4 · みんな 2」の内訳を出す
- 日ビューの `DayHud`：各予定に所有者チップ（共有は 2 色）と所有者名。自分の予定でないものには「参加する」（自分を所有者に追加 → 共有の予定になる）。自分の予定には「削除」（1 人の予定なら消える。共有の予定なら「抜ける」になり、自分だけ所有者から外れて相手の予定として残る）。下部のフォームでタイトル・種類（8 種の建物チップ）を選び、「誘う」で他のメンバーにチェックを入れて「建てる」と、自分＋誘った人の共有の予定として 1 件追加される（例：たろうがはなこを誘う → 所有者 [たろう, はなこ]。両者のカレンダーに同じ予定が入る）。誘わなければ自分だけの予定
- 状態管理は `hooks/useSharedCalendar.ts` の 1 か所。予定の `login` / `addEvent` / `joinEvent` / `removeEvent` と管理の `addPluginEntry` / `removePluginEntry` / `setPluginGoal` は `/api` に書いてから読み直す。`logout` と、今入っている名前の記憶だけはこのブラウザ。初回と、その後 2 秒ごとに `GET /api/calendar` と `GET /api/plugins` する。内容が同じなら画面は描き直さない。予定の失敗は地図を止めてエラー全文。プラグインの失敗は地図を残し、パネルにエラー全文
- **島の並べ方（`IslandLayout`）は 2 通り**。HUD 右上のボタンで切り替える（メンバーが 2 人以上のときだけ有効）
  - `merged`（既定）「ひとつの島」：メンバー全員の予定を 1 つの島に建てる。持ち主はホバーの台座で見分ける（上記）
  - `split`「ふたりの島」：手前に自分の島（自分が所有者の予定）、海を挟んで奥に相方の島（相方が所有者の予定）を並べる。**ふたりが所有者の予定がある日は、塔と塔の間をハートの旗を曳く飛行機（`Flight.tsx`）が往復する**。相方は自分以外の先頭メンバー。3 人以上いるときは凡例の「奥の島：」チップで選ぶ。奥の島は飾り（ホバー・クリック不可）。両島のデータは同じ共有カレンダーから `owners` で振り分ける（`lib/members.ts` の `eventsOwnedBy` / `datesSharedBetween`）ので、片方で「誘う」や「参加する」をすると即座に両島と飛行機に反映される
  - 日ビューの HUD は並べ方に関係なく全員の予定を出す（相方の予定に参加できるようにするため）

### 5. 管理プラグイン（家計簿は同梱の 1 件）

- 管理機能は `server/plugins/<id>/manifest.json`（任意で `sample.json`）と、画面の `src/src/plugins/effects/index.ts` の effect キー。コードにプラグイン id を書かない。同梱は `ledger`（家計簿、effect `luxury`）と `study`（勉強時間、effect `study`。月 100 時間で図書館）
- フィールドの type は `number` / `choice` / `text` / `longtext` / `tags`。`number` と `choice` は progress（達成計算）、それ以外は memo（振り返り一覧だけ）
- 進捗の式は `count` / `sum:` / `sum_if:` / `latest:` / `delta:` を `+` と `-` でつないだもの。compare は `gte` か `lte`。goal は `per_period` か `{ "fixed": 数値 }`。目標の無い月は未達成
- 家計簿の式は収入合計 − 支出合計。固定サンプルは月目標 50,000 円。12 月・3 月などは達成、6 月・8 月・10 月などは未達。デモ開始の繁忙月（3 月）が黄金郷になる
- **保存先は、サーバーを動かしているPCの SQLite**（`server/data/ledger.sqlite`）。テーブルは `plugin_entries` と `plugin_goals`。同じWi-Fiの人は、そのPCで `npm run dev` が出した Network のURLを開く。API 自体は 127.0.0.1 のまま。失敗したらエラー文をそのまま出し、ブラウザ保存へ逃げない
- 起動時、旧 `ledger_entries` / `monthly_goals` があれば `ledger` プラグインへ移してから参照しない。空のプラグインは `sample.json` があればそれを入れる（プラグイン名で分岐する seed は書かない）
- Webhook はマニフェストの `webhooks`（`on` は `entry.created` か `goal.achieved`、`urlEnv` は `secret/.env` の変数名、`body` は `json` か `discord`）。保存成功後に送る。失敗は 502 で、保存済みの記帳は消さない。inbound は `POST /api/plugins/<id>/inbound`、ヘッダ `X-Plugin-Token`
- 新しいプラグインの雛形は `cd server && source .venv/bin/activate && python new_plugin.py <id> <タイトル>`
- API（すべて JSON。失敗時は `{ "error": "<例外メッセージ>" }`）：
  - `GET /api/plugins` → `{ plugins: [{ manifest, entries, goals }, ...] }`
  - `POST /api/plugins/<id>/entries` 本文 `{ date, owner, values }` → 201 で 1 件
  - `DELETE /api/plugins/<id>/entries/<entryId>?user=<名前>` → 204。自分の記帳以外は 403
  - `PUT /api/plugins/<id>/goals` 本文 `{ year, month, amount }` → `{ plugin, yearMonth, amount }`
  - `POST /api/plugins/<id>/inbound`
  - `GET /api/calendar` → `{ members, events }`
  - `POST /api/members` 本文 `{ name }` → `{ members }`
  - `POST /api/events` 本文 `{ date, title, category, owner, invited, place }` → 201 で 1 件。`place` は任意
  - `POST /api/events/<id>/join` 本文 `{ user }` → 予定 1 件
  - `POST /api/events/<id>/leave` 本文 `{ user }` → `{ event }`。最後の所有者が抜けると `event` は null
  - `POST /api/reset` → 予定と全プラグインをサンプルで作り直し、`{ members, events, plugins }`
  - `GET /api/health` → `{ "ok": true }`
  - `POST /api/suggest` 本文 `{ date, title, category, place }` → `{ place: { name, lat, lon }, weather, items, message }`。`message` は LINE へ送信済み。YuMake の予報範囲外の日付や、キー未設定、場所が見つからないときは `{ "error": "<例外メッセージ>" }` で止める

### 6. 持ち物提案（場所を入れた予定）

- キーは `secret/.env`（`CLAUDE_API_KEY` / `YUMAKE_API_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_PUSH_TO`）。サンプルは `secret/.env.template`
- 画面は `/api/suggest` だけを呼ぶ。Overpass・YuMake・Claude・LINE の URL もキーもフロントに置かない
- 天気は YuMake 体感温度予報（`feelsLike.php?lat&lon`）。目的地の緯度経度を Overpass からそのまま渡せる。公開 Overpass が 502 か 504 のときは、同じ検索を 2 秒、4 秒、8 秒待って最大 4 回までやり直す。それでも失敗したらそのエラーをそのまま出す。予報は発表時刻から最大 78 時間先なので、デモでは今日から 3 日以内の日付で場所を入れる
- Claude は持ち物の案を作り、同じ天気の数値で検討し直してから LINE の本文を書く。降水が 0 で天気が雨・雪・雷でないときは傘などの雨具を送らない。防寒は体感の最低が 18℃未満、暑さ対策は体感の最高が 22℃以上のときだけ。検討後も矛盾が残ったら送らずにエラーで止める。本文は絵文字と空行で区切る
- LINE は Messaging API の push（`/v2/bot/message/push`）。送信先は LINE Developers コンソールのユーザー ID（`LINE_PUSH_TO`）。ボットを友だち追加したアカウントだけ届く

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
  place?: string;        // 行き先。持ち物提案に使う。'' または未設定は場所なし
}

export type ViewState =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }               // month: 1-12
  | { kind: 'day'; year: number; month: number; day: number };

// src/src/types/ledger.ts
export type IslandTheme = 'plain' | 'luxury';

// src/src/types/plugins.ts
export interface PluginManifest {
  id: string;
  title: string;
  fields: PluginField[];
  progress: { label: string; formula: string; compare: 'gte' | 'lte'; goal: 'per_period' | { fixed: number } };
  effect: string;        // plugins/effects/index.ts のキー
}

export interface PluginEntry {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  owners: string[];
  values: Record<string, number | string | string[]>;
}
```

- カテゴリ → ボクセル建物コンポーネントの対応表を `components/models/objects/index.ts` に 1 か所で持つ（新カテゴリ追加は「型に 1 行 + 対応表に 1 行 + 建物ファイル 1 つ」）
- 日別集計は `lib/calendar.ts` の純関数で行う（`groupEventsByDate`、`buildMonthGrid`）。React 側は計算しない

## 3D 表現の規約

- 単位：1 マス = 1 × 1（`CELL_SIZE`）。タワーの幅は 1.0（`TOWER_WIDTH`。マスいっぱいに使う）、ブロックの高さは 0.5（`BLOCK_HEIGHT`）。グリッドは原点中心に置き、x = 曜日（`colToX`）、z = 週（`rowToZ`）、y = 高さ。変換は `lib/camera.ts` に集約
- ブロックの質感は高さ（level）で決める：0 = 草の地面、1〜2 = 土（天面なら草）、3〜5 = 石、6 以上 = 雪（`blockKindForLevel`）。黄金郷では 0 = 砂金の浜、それより上は金。黄金郷の高い塔（予定 4 件以上）は側面に金の $ 看板（`luxury/DollarSign`）、6 件以上は屋上にヘリが付く（`LuxuryRooftop`）
- ブロックは `BoxGeometry` + `MeshStandardMaterial` の 6 面配列（フラットな単色。テクスチャ画像は使わない）。材質はモジュール定数として共有する
- 建物モデルは **1 ファイル 1 建物**、`export const Salon = ({ position }: ObjectProps) => …` 形式。中身は `Voxel`（位置・サイズ・色）を `<group>` で束ねた、底面 0.26 × 0.26・高さ 0.45 以内のボクセル（3×3・ピッチ 0.29 に収めるため）。色→材質は `materialFor` でキャッシュして共有する
- ライト：`ambientLight` + 影付き `directionalLight` 1 灯。背景は CSS の空色グラデーション（Canvas は透過）、地面の下に海面（青い平面）、遠景に `fog`（水平線色）で「島の地図」感を出す
- インタラクション：`onPointerOver` / `onClick` はタワーの `group` で受け、`stopPropagation` で手前のタワーだけ反応させる。ハイライトは金色の半透明ボックスをタワーに重ねる（材質の複製は作らない）。ホバーでカーソルを pointer に
- カメラ：`CameraRig` が `pose` の変化を検知して `camera.position` と `OrbitControls.target` を指数補間で寄せ、到着したら補間を止めてユーザー操作に任せる
- パフォーマンス：1 か月分は 31 日 × 最大 11 段 + 建物 ≒ 数百〜千 mesh で問題ない。日付ラベルのピクセルだけは `InstancedMesh` 1 描画にまとめる。年 3D 化（将来）の段階でブロックの `InstancedMesh` 化を検討する

## 固定データ（デモ用）

- `src/src/data/sampleEvents.ts`：対象年 1 年分の予定。月ごとに山谷がはっきり出るよう、**繁忙月（例：3 月・12 月）と閑散月（例：8 月）** を意図的に作る。デモで最初に見せる月には 1 日に 8〜10 件入る日を置き、「高い塔の上の小さな町」が成立するようにする
- `server/plugins/ledger/sample.json`：対象年 1 年分の家計（プラグイン形式）。給与・家賃と月ごとの支出割合で、達成月と未達月を意図的に作る。中身は `seed.py` / `sampleLedger.ts` と同じシード
- ファイル名・変数名で固定データと分かるようにする（`sampleEvents` / `sample.json` / `sampleLedger`）

## src/ 配下の構造（実装に合わせて最新化済み：2026-11-03）

```
server/                            ← 予定・管理プラグインのローカルサーバー（Python 3.11・標準ライブラリのみ）
├─ .venv/                          ← 仮想環境
├─ app.py                          ← 127.0.0.1:8787 の HTTP。/api/plugins と /api/calendar と /api/suggest
├─ db.py                           ← SQLite のスキーマ・予定/メンバーの CRUD。失敗時は例外を隠さない
├─ plugin_store.py                 ← マニフェスト検証・記帳・達成計算・Webhook・inbound
├─ new_plugin.py                   ← id とタイトルからマニフェストと看板エフェクトの雛形を作る
├─ seed.py                         ← sampleEvents.ts / sampleLedger.ts と同じシード
├─ plugins/
│   ├─ ledger/                     ← 家計簿。effect luxury
│   │   ├─ manifest.json
│   │   └─ sample.json
│   └─ study/                      ← 勉強時間。effect study（図書館）
│       └─ manifest.json
├─ suggest.py                      ← Overpass → YuMake → Claude → LINE。キーは secret/.env
├─ tests/                          ← unittest（DB と API。ledger プラグインで通す）
└─ data/
    └─ ledger.sqlite               ← 本機の予定・管理 DB（gitignore 対象）

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
   │   ├─ calendar.ts              ← CalendarEvent / EventCategory / ViewState / CATEGORY_INFO（色・表示名）
   │   ├─ ledger.ts                ← IslandTheme（plain / luxury）。家計簿の型はプラグインの values
   │   └─ plugins.ts               ← PluginManifest / PluginEntry / PluginData
   ├─ data/
   │   ├─ sampleEvents.ts          ← 固定データ：2026 年一年分のサンプル予定（シード固定生成）
   │   └─ sampleLedger.ts          ← 固定データ：家計簿サンプルのシード（server/plugins/ledger/sample.json と同じ）
   ├─ lib/
   │   ├─ calendar.ts              ← 月グリッド計算・日別集計・最繁忙月・日付表記（純関数）
   │   ├─ camera.ts                ← グリッド座標 ⇄ ワールド座標、月俯瞰（1 島 / 2 島）/ 日ズームのカメラ姿勢、相方の島の z オフセット
   │   ├─ pixelFont.ts             ← 3×5 ピクセルフォント（数字と SUN〜SAT に必要な英字）
   │   ├─ members.ts               ← メンバー識別色、所有者チップの背景、所有者別の件数内訳、島ごとの予定の振り分け
   │   ├─ plugins.ts               ← 進捗の式・達成判定・表記（純関数。plugin_store.py と同じ意味）
   │   ├─ calendarApi.ts           ← 予定とメンバー（/api/calendar）の呼び出し。失敗時は Error を投げる
   │   ├─ suggestApi.ts            ← 持ち物提案（/api/suggest）。失敗時は Error を投げる
   │   ├─ pluginsApi.ts            ← 管理プラグイン（/api/plugins）の呼び出し。失敗時は Error を投げる
   │   └─ storage.ts               ← localStorage の読み書き（version 4。ログイン中の名前だけ）
   ├─ hooks/
   │   └─ useSharedCalendar.ts     ← 予定・メンバーは /api/calendar、管理は /api/plugins。ログイン中の名前だけ localStorage。2 秒ごとに読み直す
   ├─ plugins/
   │   └─ effects/
   │       ├─ index.ts             ← effect 名 → 島の見た目（luxury は黄金郷、study は図書館）
   │       ├─ Luxury.tsx           ← マネーレインと海のヨット
   │       └─ StudyEffect.tsx      ← 島の奥と左右の海に置く本棚・大きな本（島は覆わない）
   ├─ components/
   │   ├─ year/
   │   │   ├─ YearHeatmap.tsx      ← 年ビュー：12 か月の島カード（月名・件数・7 列 × 週数のミニマップ、黄金郷は金枠）
   │   │   └─ YearIslands.css      ← 年ビュー専用スタイル
   │   ├─ month/
   │   │   ├─ MonthScene.tsx       ← <Canvas>、ライト、fog、海面、OrbitControls、DayTower と日付ラベルの配置（split なら相方の島と飛行機も。達成 effect の Scene を重ねる）
   │   │   ├─ Flight.tsx           ← ふたりの予定の日に島と島を往復するボクセル飛行機（ハートの旗）
   │   │   ├─ LuxuryFx.tsx         ← 黄金郷のマネーレイン（島の外周。厚みのある金貨と凹版の札。InstancedMesh）
   │   │   ├─ LuxuryMarina.tsx     ← 海のヨットと周回ヘリ
   │   │   ├─ LuxuryRooftop.tsx    ← 屋上のヤシ・プール・車・噴水・ヘリ
   │   │   ├─ DayTower.tsx         ← 1 日分：地面 + 積みブロック + 屋上 3×3 の建物 + ハイライト + 出現アニメ（luxury ならリゾート屋上）
   │   │   ├─ Sea.tsx              ← 全体の海面（揺れる水面）
   │   │   ├─ Villagers.tsx        ← 出現アニメ後に島の上を歩く村人
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
   │   │   ├─ objects/             ← 屋上に並べる建物（1 ファイル 1 棟。各カテゴリ 3 バリエーション）
   │   │   │   ├─ types.ts         ← ObjectProps
   │   │   │   ├─ index.ts         ← EventCategory → コンポーネント対応表（バリエーションはスロット座標で決定的に選ぶ）
   │   │   │   ├─ Salon.tsx / Salon2.tsx / Salon3.tsx                ← 美容室
   │   │   │   ├─ Restaurant.tsx / Restaurant2.tsx / Restaurant3.tsx ← 飲食
   │   │   │   ├─ Office.tsx / Office2.tsx / Office3.tsx             ← 仕事
   │   │   │   ├─ Church.tsx / Church2.tsx / Church3.tsx             ← 結婚式（Petals を含む）
   │   │   │   ├─ Petals.tsx       ← 頂上から舞い落ちる花びら（useFrame で 12 粒を周回）
   │   │   │   ├─ Hospital.tsx / Hospital2.tsx / Hospital3.tsx       ← 病院
   │   │   │   ├─ Gym.tsx / Gym2.tsx / Gym3.tsx                      ← ジム
   │   │   │   ├─ Airplane.tsx / Airplane2.tsx / Airplane3.tsx       ← 旅行
   │   │   │   └─ School.tsx / School2.tsx / School3.tsx             ← 学校
   │   │   └─ luxury/              ← 黄金郷の装飾パーツ
   │   │       ├─ GoldVoxel.tsx    ← 金ボクセルの最小単位
   │   │       ├─ Palm.tsx / Pool.tsx / Car.tsx / Fountain.tsx ← 屋上のヤシ・プール・金の車・噴水
   │   │       ├─ DollarSign.tsx   ← 高い塔の側面の金の $ 看板
   │   │       ├─ Helicopter.tsx   ← ヘリ（屋上と周回）
   │   │       └─ Yacht.tsx        ← 海のヨット
   │   └─ hud/
   │       ├─ LoginScreen.tsx      ← ユーザー名だけのログイン、既存メンバーのワンクリック、サンプルに戻す
   │       ├─ MonthHud.tsx         ← 月名・前後月・年ビューへ・管理プラグインのボタンと進捗・現在のユーザー・凡例・ホバーの日付と所有者内訳
   │       ├─ PluginHud.tsx        ← 開いているプラグイン：マニフェストから入力欄、進捗、目標、記帳、削除
   │       └─ DayHud.tsx           ← 日付・予定一覧（所有者チップ・場所・持ち物を提案・参加する/削除/抜ける）・予定を建てるフォーム（場所・種類チップ・誘う）・持ち物提案の結果・月に戻る
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
| F. 管理プラグインと達成エフェクト | `types/plugins.ts` / `lib/plugins.ts` / `lib/pluginsApi.ts` / `plugins/effects/**` / `components/hud/PluginHud.tsx` / `server/plugins/**` / `server/plugin_store.py` |
| 共有（声をかけてから） | `App.tsx` / `main.tsx` / `types/calendar.ts` / `package.json` 等の設定ファイル |
