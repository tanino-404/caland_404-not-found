# 管理内容プラグイン

1 フォルダ = 1 プラグイン。フォルダごとコピーすれば配布できる。画面のコードは触らない。

```
plugins/
└─ <id>/            ← id は英小文字・数字・ハイフン。plugin.json の id と同じ
   ├─ plugin.json   ← 定義（必須）
   ├─ sample.json   ← サンプルデータ（任意。空のときサーバー起動とリセットで入る）
   └─ README.md     ← 使い方（任意）
```

- 雛形：`cd server && source .venv/bin/activate && python new_plugin.py <id> <名前>`
- 検証：`python plugins.py validate [id]`（plugin.json と sample.json の両方）
- 例：`fishing`（釣り）`nisa` `fitness` `pets` `cooking` `study`（自主勉強）`game`。家計簿 `ledger` だけはサンプルを `server/seed.py` で作る

## plugin.json

| キー | 内容 |
| --- | --- |
| `schemaVersion` | 1 |
| `id` / `name` / `version` | 識別子・表示名・版 |
| `fields` | 1 件の記録の項目。`{ key, type, label, required?, options?, min?, max?, unit? }`。type は `text` `number` `integer` `select` `tags` `boolean` `date` `place`。`select` の options は `{ value, label }` の配列。数値以外（text・tags・place）は目標に使わず振り返り用 |
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

- `theme`：島の土台。`plain`（草・土・石・雪）、`luxury`（黄金郷）、`muscle`（マッチョの島：巨大なボディビルダー・PROTEIN 看板・シェイカー・石レンガの塔）、`library`（知識の島：大図書館・LIBRARY の塔・巨大な本・読書の広場・滝）
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

記録・目標はグループ id に属する。グループはプラグインごとに複数作れ、メンバーを紐づける。画面は先頭のグループを表示し、メンバーでなければ「このグループに入って記録する」が出る。

## 外部連携

- 送信 `{ id, direction: "outgoing", on: "entry.created" | "goal.achieved", adapter: "json" | "discord", urlEnv, template? }`
  - URL は変数名で書き、値は `secret/.env` に置く（実行時の環境変数があればそちらが先）。Discord は `template` に `{pluginName}` `{value}` `{target}` `{progress}` や項目 key を書ける
- 受信 `{ id, direction: "incoming", map: { 項目key: "本文の.位置" }, dateFrom?, tokenEnv? }`
  - `POST /api/plugins/<id>/groups/<group>/ingest/<連携id>?user=<名前>`。`tokenEnv` があれば `X-Plugin-Token` ヘッダーで照合（値は `secret/.env`）
- 新しい API 形式は `server/plugins.py` の `ADAPTERS` に 1 関数足す

## API

- `GET /api/plugins` / `GET /api/plugins/<id>`
- `GET|POST /api/plugins/<id>/groups`、`POST .../groups/<g>/members`
- `GET|POST .../groups/<g>/entries`（`?from&to`）、`DELETE .../entries/<entry>?user=`
- `GET|POST .../groups/<g>/goals`、`DELETE .../goals/<goal>?user=`
- `GET .../groups/<g>/status?at=YYYY-MM-DD` → `{ goal, op, value, progress, achieved, finished, effect }`
