---
name: statusline
description: >-
  CLI にカスタムステータスラインを設定する。ユーザーがステータスライン、statusline、
  statusLine、CLI ステータスバー、プロンプトフッターのカスタマイズに言及したとき、
  またはプロンプトの上にセッションコンテキストを追加したいときに使う。
---
# CLI ステータスライン

CLI は、プロンプトの上に表示されるユーザー設定可能なステータスラインをサポートしています。会話が更新されるたびにコマンドが起動され、セッションを記述する JSON ペイロードを stdin で受け取り、その stdout がステータスラインとして表示されます。仕様は [Claude Code のステータスライン](https://code.claude.com/docs/en/statusline)に準拠しています。

## 設定

`~/.cursor/cli-config.json` に `statusLine` エントリを追加します:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.cursor/statusline.sh",
    "padding": 2
  }
}
```

`command` フィールドはフルパス、`~` の展開、シェル形式の引数分割をサポートします。スクリプトファイルを指定することも、`jq -r '...'` のようなインラインコマンドを使うこともできます。

| フィールド | 必須 | デフォルト | 説明 |
|-------|----------|---------|-------------|
| `type` | はい | — | `"command"` でなければならない |
| `command` | はい | — | 実行ファイルへのパスまたはインラインコマンド。`~` は展開される。 |
| `padding` | いいえ | `0` | ステータスラインコンテナの水平方向の余白（文字数）。 |
| `updateIntervalMs` | いいえ | `300` | 呼び出し間の最小間隔。300ms 以上にクランプされる。 |
| `timeoutMs` | いいえ | `2000` | コマンドが kill されるまでに実行できる最大時間。 |

## stdin ペイロード

コマンドは stdin で JSON オブジェクトを受け取ります。TypeScript インターフェースは `packages/agent-cli/src/hooks/use-status-line.ts` の `StatusLinePayload` です。

### 完全な JSON スキーマ

```json
{
  "session_id": "abc123",
  "session_name": "my session",
  "transcript_path": "/path/to/transcript.jsonl",
  "render_width_chars": 120,
  "cwd": "/Users/me/project",
  "autorun": false,
  "model": {
    "id": "claude-4-opus",
    "display_name": "Claude 4 Opus",
    "param_summary": "(Thinking)",
    "max_mode": true
  },
  "workspace": {
    "current_dir": "/Users/me/project",
    "project_dir": "/Users/me/project/.cursor/transcripts",
    "added_dirs": []
  },
  "version": "1.2.3",
  "output_style": {
    "name": "default"
  },
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": null,
    "context_window_size": 200000,
    "used_percentage": 34.5,
    "remaining_percentage": 65.5,
    "current_usage": null
  },
  "vim": {
    "mode": "NORMAL"
  },
  "worktree": {
    "name": "my-feature",
    "path": "/Users/me/.cursor/worktrees/repo/my-feature"
  }
}
```

### 利用可能なフィールド

| フィールド | 説明 |
|-------|-------------|
| `session_id` | 一意のセッション識別子 |
| `session_name` | カスタムセッション名。名前が設定されていない場合は存在しない |
| `transcript_path` | 会話トランスクリプトファイルへのパス |
| `render_width_chars` | 使用可能なターミナル列数から組み込みのパディングを引いたもの |
| `cwd`, `workspace.current_dir` | 現在の作業ディレクトリ（両方とも同じ値を含む） |
| `autorun` | 現在のセッションで自動実行が有効な場合 `true` |
| `workspace.project_dir` | トランスクリプトが保存されるディレクトリ |
| `workspace.added_dirs` | 追加ディレクトリ（現時点では空配列） |
| `model.id`, `model.display_name` | 現在のモデルの識別子と表示名 |
| `model.param_summary` | 整形済みのパラメータサマリー（例: "(Thinking)"、"High"）。空のときは存在しない |
| `model.max_mode` | max モードが有効な場合 `true`。それ以外は存在しない |
| `version` | CLI のバージョン文字列 |
| `output_style.name` | `"default"` または `"compact"` |
| `context_window.total_input_tokens` | 推定入力トークン数（used_percentage から導出） |
| `context_window.total_output_tokens` | 累積出力トークン数（追跡していない場合は null） |
| `context_window.context_window_size` | コンテキストウィンドウの最大サイズ（トークン数） |
| `context_window.used_percentage` | コンテキストウィンドウの使用率（パーセント） |
| `context_window.remaining_percentage` | コンテキストウィンドウの残り（パーセント） |
| `context_window.current_usage` | 直近の API 呼び出しのトークン数（最初の呼び出し前は null） |
| `vim.mode` | vim モード有効時に `"NORMAL"` または `"INSERT"` |
| `worktree.name` | worktree 内で実行中の場合の worktree 名 |
| `worktree.path` | worktree ディレクトリへの絶対パス |

### 存在しない場合があるフィールド

- `session_name` — カスタム名が設定されている場合のみ存在
- `model.param_summary` — モデルにデフォルト以外のパラメータがある場合のみ存在
- `model.max_mode` — max モードが有効な場合のみ存在
- `vim` — vim モードが有効な場合のみ存在
- `worktree` — worktree 内で実行中の場合のみ存在

### null になる場合があるフィールド

- `context_window.current_usage` — 最初の API 呼び出し前は null
- `context_window.used_percentage`, `context_window.remaining_percentage` — セッション初期は null の場合がある

## stdout / レンダリング

- **複数行**をサポート: stdout の各行がステータス領域の別々の行として表示される。
- **ANSI カラーコード**をサポート（chalk、tput、`\033[32m` などを使用可能）。
- コマンドが stdout 空のまま非ゼロで終了した場合、ステータスラインは更新されない（以前のテキストが保持される）。
- コマンドがタイムアウトした場合、またはスクリプト実行中に新しい更新が届いた場合、実行中のプロセスは kill される。
- ステータスラインはローカルで実行され、API トークンを消費しない。

## 例

### 基本: モデル + コンテキスト使用率

```bash
#!/usr/bin/env bash
payload=$(cat)
model=$(echo "$payload" | jq -r '.model.display_name')
pct=$(echo "$payload" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
printf "\033[90m%s  ctx %s%%\033[0m" "$model" "$pct"
```

### コンテキストのプログレスバー

```bash
#!/usr/bin/env bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

echo "[$MODEL] $BAR $PCT%"
```

### git 情報付きの複数行表示

```bash
#!/usr/bin/env bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

BRANCH=""
git rev-parse --git-dir > /dev/null 2>&1 && BRANCH=" | 🌿 $(git branch --show-current 2>/dev/null)"

echo -e "\033[36m[$MODEL]\033[0m 📁 ${DIR##*/}$BRANCH"
echo -e "ctx $PCT%"
```

### インライン jq コマンド（スクリプトファイルなし）

```json
{
  "statusLine": {
    "type": "command",
    "command": "jq -r '\"[\\(.model.display_name)] \\(.context_window.used_percentage // 0)% context\"'"
  }
}
```

## テスト

モック入力でスクリプトをテストします:

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":25}}' | ./statusline.sh
```

コマンドは `child_process.spawn` で起動されます（Unix ではシェルなし、Windows では .cmd/.bat 互換のため `shell: true`）。更新は設定した間隔でデバウンスされます。スクリプト実行中に新しい更新がトリガーされた場合、実行中のプロセスは `AbortController` で kill され、新しい呼び出しが直ちに開始されます。
