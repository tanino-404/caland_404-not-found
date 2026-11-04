# 管理内容プラグイン

1 フォルダ = 1 プラグイン。**追加・変更は `plugins/<id>/` の中だけで完結する**。画面（`src/`）とサーバー（`server/`）のコードは触らない。フォルダごとコピーすれば配布できる。

## 仕組み

```
plugins/<id>/plugin.json ──▶ サーバー（server/plugins.py）が検証して配る
   項目・指標・目標・effects        記録・目標・グループ・インストール状態は DB
                                        │ GET /api/plugins（installed 付き）
                                        ▼
plugins/<id>/island.tsx ───▶ 画面（src/src/lib/islands.ts）
   目標達成で変わる島の見た目      import.meta.glob で plugins/*/island.tsx を見つけ、
   （React Three Fiber）            インストール済みのプラグインを表示したときだけ読み込む
        │ import
        ▼
src/src/plugin-sdk（@plugin-sdk）… 画面が島に貸す部品と型
```

- **データ（宣言）**：`plugin.json` に、毎日つける項目（fields）、数値化する指標（metrics）、目標の向き（goal）、達成率ごとの見た目（effects）、外部連携（integrations）を書く。サーバーは起動時とリクエストごとにこれを読んで検証する
- **見た目（コード）**：目標を達成した島を変えたいときだけ `island.tsx` を書く。画面は島の名前で分岐しない。島が渡した定義（`IslandDefinition`：塔のブロック、水、村人、地平の色、ライト、飾り、空の演出、屋上、凡例）を、決まった場所で描くだけ。定義に無いものは、いつもの島（草・土・石・雪）のまま
- **どの島を出すか**：その月の達成率で `effects` から 1 つ選ばれ、その `theme` が島を指す。`plain` はいつもの島。`scene`（空の色やボクセルの絵）は、島に関係なく上に重なる
- **インストール**：置いただけでは未インストール。設定画面でインストールしたものだけが「管理機能」に並び、島のコードがブラウザで動く。島のコードは島ごとに別のファイルにビルドされ、表示したときに読み込まれる

```
plugins/
└─ <id>/            ← id は英小文字・数字・ハイフン。plugin.json の id と同じ
   ├─ plugin.json   ← 定義（必須）
   ├─ sample.json   ← サンプルデータ（任意。空のときサーバー起動とリセットで入る）
   ├─ island.tsx    ← 目標達成で変わる島の定義（任意）
   ├─ island.css    ← 島を表示しているあいだだけ効く画面の CSS（任意。island.tsx から import）
   ├─ parts/        ← island.tsx が使うコンポーネント・テクスチャ（任意。名前は自由）
   └─ README.md     ← 使い方（任意）
```

同梱の例：

- 記録だけ（島は plain ＋ ボクセルの絵）：`cooking`（自炊）`pets` `game` `nisa`（黄金郷を借りる）
- 島も描く：`ledger`（黄金郷。`island.css` も）`fitness`（マッチョの島）`study`（知識の島）
- 家計簿 `ledger` だけはサンプルを `server/seed.py` で作る

## 作り方

### 1. 記録と目標だけのプラグイン（コードなし）

1. 雛形を作る：`cd server && source .venv/bin/activate && python new_plugin.py <id> <名前>`
2. `plugin.json` の `fields` `metrics` `goal` を書き換える（下の「plugin.json」）
3. 目標を達成したときの見た目は、`effects` の `scene` に空の色やボクセルの絵を宣言で書く（`theme` は `plain`）
4. サンプルを入れるなら `sample.json` を置く
5. 検証：`python plugins.py validate <id>`（plugin.json と sample.json の両方）

### 2. 島の見た目も変えるプラグイン（island.tsx）

1. 上の 1 を済ませる
2. `plugin.json` に島の名前を足し、達成時の effect の `theme` をその名前にする

   ```json
   "islands": ["my_island"],
   "effects": [
     { "id": "plain", "minProgress": 0, "theme": "plain" },
     { "id": "done", "minProgress": 1, "theme": "my_island" }
   ]
   ```

3. `island.tsx` を書く。`islands`（名前 → 定義）だけを export する。コンポーネントは `parts/` に置く（React の Fast Refresh のため、island.tsx は定義だけにする）

   ```tsx
   import {
     BLOCK_MATERIALS,
     GRASS_TOP_MATERIAL,
     type IslandDefinition,
     STONE_BOTTOM_MATERIAL,
     pixelFaces,
     pixelMaterial,
   } from '@plugin-sdk';
   import { MyDecor } from './parts/MyDecor';  // 中央の島の飾り（React コンポーネント）
   import { MY_SIDE } from './parts/textures'; // paintPixels で描いた 16×8 のドット絵

   const STONE = pixelFaces(pixelMaterial(MY_SIDE, 0, 0.9, 0), GRASS_TOP_MATERIAL, STONE_BOTTOM_MATERIAL);

   const myIsland: IslandDefinition = {
     label: '〇〇の島', // 年ビューのツールチップ
     blocks: (level, isTop) => (level === 0 ? BLOCK_MATERIALS.shore : STONE),
     Decor: MyDecor,
   };

   export const islands: Record<string, IslandDefinition> = { my_island: myIsland };
   ```

   ```tsx
   // parts/MyDecor.tsx
   import { Clouds, type IslandDecorProps, Voxel } from '@plugin-sdk';

   export const MyDecor = ({ rows, dayView }: IslandDecorProps) => (
     <>
       <Clouds />
       {dayView ? null : <Voxel x={0} y={0} z={-rows / 2 - 1.5} w={2} h={1.2} d={1} color="#e8402e" />}
     </>
   );
   ```

4. 画面だけの CSS が要るなら `island.css` を置き、`island.tsx` で `import './island.css'` する。島を表示しているあいだ `body` と `.app` に `is-island` と `is-<島の名前>` が付くので、それで絞る（例：`.app.is-my_island .hud-month-number { … }`）
5. 確認する（コマンドはすべて上のとおり。`plugins/` も含めて調べる）
   - 型チェック：`cd src && npx tsc --noEmit -p tsconfig.app.json`
   - リンター（リポジトリ直下で）：`src/node_modules/.bin/oxlint -c src/.oxlintrc.json plugins`
   - 検証：`cd server && python plugins.py validate <id>`
   - 画面：下の「適用」でインストールし、達成した月を開く。比べるときは設定のデバッグモードで天気と時刻を固定する

ほかのプラグインの島はコピーせずに借りられる：`"theme": "<プラグイン id>/<島の名前>"`（NISA は `"ledger/luxury"`）。

### 書くときの約束

- 画面のコードは `@plugin-sdk` からだけ import する。`src/src/...` を相対パスで直接読まない。`react`・`three`・`@react-three/fiber` はそのまま import してよい（画面と同じものが使われる）
- 部品は島の中央を原点に置く。x は曜日（-3〜3）、z は週（島の奥が z = -rows / 2、手前が z = rows / 2）、y は高さ（海面 `SEA_Y`、水面 `WATER_TOP_Y`）。月を送ると隣の島が x = ±32 に並ぶので、島から ±10 ぐらいに収める
- 重いもの（大きな建物）は `Decor` に書く。`Decor` は中央の島だけに付き、日ビュー（`dayView`）では建物を消して塔の町を見せる
- 毎フレームの動きは `useFrame` で ref を書き換える（React の state を使わない）。材質と形はモジュールの定数にして共有する
- エラーを飲み込まない。読み込みに失敗すると画面にエラー全文が出る

## 適用（インストールと反映）

- **インストール**：画面の「設定 → プラグイン」で「インストール」を押す。下部バーの「管理機能」に並び、選ぶと島のコードが読み込まれる。「アンインストール」で外す（記録と目標は消えない）。表示中のものを外すと、ほかのインストール済みへ切り替わる。最後の 1 つは外せない
- **導入状態**：サーバーの DB（テーブル `plugin_installs`）に残る。`"preinstalled": true` のプラグインは、サーバーが初めて見たときに導入済みになる（同梱のうち `fishing` 以外）。それ以外は未インストールから始まる
- **開発サーバー（`npm run dev`）**：再起動は要らない。フォルダを足して画面を再読み込みすると、設定の一覧に出る。`island.tsx` と `parts/` の変更はその場で反映される。`plugin.json` の変更はサーバーが次のリクエストで読み直す（2 秒ごとに画面が読み直す）
- **本番ビルド（`npm run build`）**：`island.tsx` を足したり変えたりしたら、`npm run build` をやり直して `dist/` を配り直す。Python のサーバーは止めなくてよい。`plugin.json` と `sample.json` だけの変更ならビルドも要らない
- **サンプル**：`sample.json` は、そのプラグインにまだグループが無いとき（初回起動）と、設定の「保存したデータを消してサンプルに戻す」で入る

# リファレンス

## plugin.json

| キー | 内容 |
| --- | --- |
| `schemaVersion` | 1 |
| `id` / `name` / `version` | 識別子・表示名・版 |
| `fields` | 1 件の記録の項目。`{ key, type, label, required?, options?, min?, max?, unit? }`。type は `text` `number` `integer` `select` `tags` `boolean` `date` `place`。`select` の options は `{ value, label }` の配列。数値以外（text・tags・place）は目標に使わず振り返り用 |
| `preinstalled` | 任意。`true` なら最初から導入済み（上の「適用」） |
| `islands` | 任意。`island.tsx` が描く島の名前の配列（英小文字の key、`plain` 以外）。書いたら `island.tsx` が必須 |
| `metrics` | 数値化する指標。`{ key, label, agg, field?, unit?, where?, negateWhen?, op? }` |
| `goal` | 既定で目標に使う指標と向き。`{ metric, op: ">=" \| "<=" }` |
| `effects` | 達成率ごとの島の見た目（下記） |
| `integrations` | 外部連携（下記） |

### metrics

- `agg`：`sum` `count` `max` `min` `avg` `latest` `delta`。`delta` は期間内の最後の値 − 最初の値（体重の増減など）
- `where: { field, values }`：select がこの値の記録だけ集計する（成長投資枠だけ、数学だけ）
- `negateWhen: { field, values }`：select がこの値なら符号を反転する（支出を引く）
- `op`：この指標で目標を立てたときの向き。無ければ `goal.op`。体重を減らす目標は `"<="` で目標値を `-3` にする

## 目標の期間

目標は指標・`start`〜`end`・目標値を自由に決める（画面のパネルか API）。その日に見せるのは、期間中か直前に終わった目標のうち最も近いもの。同じ月にテストが 2 回あれば、2 回目の後は 2 回目の結果を出す。期間まで同じなら後から作った方。

## 目標達成エフェクト（effects）

`{ id, minProgress, theme, scene? }` の配列。達成率（0〜1）が届いた中で最大の `minProgress` を使う。`minProgress: 0` は必須。

- `theme`：島の土台。`plain`（いつもの草・土・石・雪）、自分の `islands` に書いた名前、または `<プラグイン id>/<島の名前>` でほかのプラグインの島を借りる（NISA は `ledger/luxury` で黄金郷を使う）。借りる島はそのプラグインの `islands` にある必要がある
- `scene`：土台に重ねるもの。すべて任意
  - `sky` `horizon` `ambient`：空・遠景の霧・環境光の色（`#rrggbb`）
  - `sprites`：ボクセルの絵（8 種類まで）。`{ model, count, zone, motion, size, speed? }`
    - `model`：`{ palette: { 1 文字: 色 }, layers, glow? }`。`layers` は下の段から上の段へ、各段は奥の行から手前の行へ、行の 1 文字が 1 ボクセル（`.` は空）。`glow: true` でネオンのように光る
    - `zone`：`sea`（海）`sky`（空）`shore`（島の周り。砂の小島に立つ）`rooftop`（予定の塔の屋上）
    - `motion`：`orbit`（周回）`jump`（海から跳ねる）`bob`（ゆれる）`hop`（跳ねる）`pump`（腕を曲げるように傾く）
    - `size`：1 ボクセルの大きさ（0.01〜0.5）。`count` は 1〜40。ボクセル数 × count の合計は 4000 まで

## sample.json

```json
{
  "groups": [{ "id": "<id>-home", "name": "表示名", "members": ["たろう"] }],
  "entries": [{ "group": "<id>-home", "date": "2026-03-01", "owners": ["たろう"], "data": { "項目key": 1 } }],
  "goals": [{ "group": "<id>-home", "label": "3月の目標", "start": "2026-03-01", "end": "2026-03-31", "target": 10, "metric": "省略可" }]
}
```

## グループ

記録・目標はグループ id に属する。グループはプラグインごとに複数作れ、メンバーを紐づける。画面は、島の持ち主（自分の島は自分、友達の島は友達）が入っている先頭のグループの記録で島の見た目を決める。自分がどのグループにも入っていないプラグインは、パネルの「○○を始める」で自分だけのグループを作る。

## 外部連携

- 送信 `{ id, direction: "outgoing", on: "entry.created" | "goal.achieved", adapter: "json" | "discord", urlEnv, template? }`
  - URL は変数名で書き、値は `secret/.env` に置く（実行時の環境変数があればそちらが先）。Discord は `template` に `{pluginName}` `{value}` `{target}` `{progress}` や項目 key を書ける
- 受信 `{ id, direction: "incoming", map: { 項目key: "本文の.位置" }, dateFrom?, tokenEnv? }`
  - `POST /api/plugins/<id>/groups/<group>/ingest/<連携id>?user=<名前>`。`tokenEnv` があれば `X-Plugin-Token` ヘッダーで照合（値は `secret/.env`）
- 新しい API 形式は `server/plugins.py` の `ADAPTERS` に 1 関数足す

## 島の定義（IslandDefinition）

`IslandDefinition`（`src/src/types/island.ts`）。`label` 以外は任意で、無いものはいつもの島のまま。

| キー | 内容 |
| --- | --- |
| `label` | 年ビューのツールチップに出す島の名前 |
| `legend` | 月ビューの凡例。予定の種類 8 つの呼び名と島の説明 `{ categoryLabels: { beauty, restaurant, work, wedding, hospital, gym, travel, school }, description }` |
| `blocks(level, isTop)` | 塔のブロックの材質（6 面の配列か 1 つ）。level 0 は海に接する縁、isTop は白い日付が載る最上段 |
| `blocksInYear` | `true` なら年ビューの島も `blocks` で描く |
| `water` | 予定の無い日の水 `{ color, roughness, metalness, opacity }` |
| `villagers` | 村人の服 `{ shirts: [色], pants: [色] }` |
| `horizon` | 時刻帯ごとの地平の色 `{ day?, evening?, night? }` |
| `Lights` | ライトを足すコンポーネント。`{ dayPhase }` を受け取る |
| `Decor` | 中央の島だけに付ける飾り。`{ rows, dayView, tallest }`。島の奥は z = -rows/2、手前は z = rows/2。日ビュー（`dayView`）では大きな建物を出さない。`tallest` はいちばん高い塔 `{ x, z, top }` か null |
| `Fx` | 月を送ると 1 秒でフェードする空の演出。`{ active, flare }`。`const { fade, group } = useSkyFade(active)` の `group` を外側の `<group ref={group}>` に付け、`fade`（0〜1）で大きさや透明度を変える。flare は画面全体のレンズフレアを付けてよいか |
| `Rooftop` | 予定のある塔の屋上に足すもの。`{ dateKey, count, y }` |

## SDK（`@plugin-sdk`）

`src/src/plugin-sdk/index.ts`。島に貸す部品と型。足りない部品があれば、その部品を SDK に足す（プラグインからは画面のファイルを直接読まない）。

- 寸法：`BLOCK_HEIGHT` `TOWER_WIDTH` `SEA_Y` `WATER_TOP_Y` `colToX` `rowToZ` `towerTopY`
- ボクセル：`Voxel` `GoldVoxel` `UNIT_BOX` `materialFor` `materialForMetal` `pixelArtGeometry`（ドット絵を押し出した板）
- ブロック：`paintPixels` `noise`（ドット絵のテクスチャ）、`pixelMaterial` `pixelFaces` `standardMaterial`、`BLOCK_MATERIALS`（いつもの草・砂・土・石・雪）、`GRASS_TOP_MATERIAL` `STONE_BOTTOM_MATERIAL`
- 小物：`Clouds`（雲海）`FloatingIsland` `Palm` `OakTree` `LampPost` `Glow`（光る箱）`WaterfallCliff`
- 空の演出：`useSkyFade` `PixelRain` `Glints` `SunFlare` `buildFallers`
- 型：`IslandDefinition` `IslandDecorProps` `IslandFxProps` `IslandRooftopProps` `BlockMaterial` `EventCategory` `DayPhase`

## API

- `GET /api/plugins`（各定義に `installed` が付く）/ `GET /api/plugins/<id>`
- `POST /api/plugins/<id>/install`（インストール）/ `DELETE /api/plugins/<id>/install`（アンインストール）
- `GET|POST /api/plugins/<id>/groups`、`POST .../groups/<g>/members`
- `GET|POST .../groups/<g>/entries`（`?from&to`）、`DELETE .../entries/<entry>?user=`
- `GET|POST .../groups/<g>/goals`、`DELETE .../goals/<goal>?user=`
- `GET .../groups/<g>/status?at=YYYY-MM-DD` → `{ goal, op, value, progress, achieved, finished, effect }`
