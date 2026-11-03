# 管理内容プラグイン

1 フォルダ = 1 プラグイン。フォルダごとコピーすれば配布できる。

```
plugins/
└─ <id>/            ← id は英小文字・数字・ハイフン。plugin.json の id と同じ
   ├─ plugin.json   ← 定義（必須）
   └─ README.md     ← 使い方（任意）
```

検証：`cd server && source .venv/bin/activate && python plugins.py validate [id]`

## plugin.json

| キー | 内容 |
| --- | --- |
| `schemaVersion` | 1 |
| `id` / `name` / `version` | 識別子・表示名・版 |
| `fields` | 1 件の記録の項目。`{ key, type, label, required?, options?, min?, max?, unit? }`。type は `text` `number` `integer` `select` `tags` `boolean` `date` `place`。`select` の options は `{ value, label }` の配列（label が画面の表示名になる）。数値以外（text・tags・place）は目標判定に使わず振り返り用 |
| `metrics` | 数値化する指標。`{ key, label, agg, field?, negateWhen? }`。agg は `sum` `count` `max` `min` `avg` `latest`。`negateWhen` は select の値で符号を反転（支出を引く等） |
| `goal` | 目標に使う既定の指標と向き。`{ metric, op: ">=" \| "<=" }` |
| `effects` | 達成率（0〜1）ごとの島の見た目。`{ minProgress, theme }`。到達した中で最大の minProgress を使う。0 は必須 |
| `integrations` | 外部連携（下記） |

## 目標の期間

目標は `start`〜`end` を自由に決める（API で登録）。表示する日 `at` に対しては、期間中か直前に終わった目標のうち、`at` に最も近いものを使う。同じ月にテストが 2 回あれば、2 回目の後は 2 回目の結果を出す。

## グループ

記録・目標はグループ id に属する。グループはプラグインごとに複数作れ、メンバーを紐づける。

## 外部連携

- 送信 `{ id, direction: "outgoing", on: "entry.created" | "goal.achieved", adapter: "json" | "discord", urlEnv, template? }`
  - URL は環境変数名で書く（`secret/.env`）。Discord は `template` に `{pluginName}` `{value}` `{target}` `{progress}` や項目 key を書ける
- 受信 `{ id, direction: "incoming", map: { 項目key: "本文の.位置" }, dateFrom?, tokenEnv? }`
  - `POST /api/plugins/<id>/groups/<group>/ingest/<連携id>?user=<名前>`。`tokenEnv` があれば `X-Plugin-Token` ヘッダーで照合
- 新しい API 形式は `server/plugins.py` の `ADAPTERS` に 1 関数足す

## API

- `GET /api/plugins` / `GET /api/plugins/<id>`
- `GET|POST /api/plugins/<id>/groups`、`POST .../groups/<g>/members`
- `GET|POST .../groups/<g>/entries`（`?from&to`）、`DELETE .../entries/<entry>?user=`
- `GET|POST .../groups/<g>/goals`、`DELETE .../goals/<goal>?user=`
- `GET .../groups/<g>/status?at=YYYY-MM-DD` → `{ goal, value, progress, achieved, finished, effect }`
