---
name: create-hook
description: >-
  Cursor のフックを作成します。フックを作りたい、hooks.json を書きたい、
  フックスクリプトを追加したい、エージェントのイベント前後の挙動を自動化したい
  ときに使います。
---
# Cursor フックの作成

Cursor にエージェントのイベントの前後でカスタムロジックを実行させたいときは、フックを作成します。フックは、stdin/stdout 経由で JSON をやり取りするスクリプトまたはプロンプトベースのチェックであり、挙動の観察、ブロック、書き換え、フォローアップができます。

ユーザーがフックを求めたときは、フォーマットの説明で終わらせないでください。不足している要件を収集した上で、フックのファイルを直接作成または更新してください。

## 要件の収集

何かを書く前に、以下を確定させます:

1. **スコープ**: プロジェクトフックにすべきか、ユーザーフックにすべきか？
2. **トリガー**: どのイベントでフックを実行すべきか？
3. **挙動**: 監査、拒否/許可、入力の書き換え、コンテキストの注入、ワークフローの継続のどれをすべきか？
4. **実装**: コマンドフック（スクリプト）にすべきか、プロンプトフックにすべきか？
5. **フィルタリング**: 特定のツール、コマンド、サブエージェントタイプに対してのみ実行するための matcher が必要か？
6. **安全性**: 失敗時はフェイルオープンにすべきか、フェイルクローズドにすべきか？

可能な限り会話から推測してください。不足している部分だけを質問します。

## 適切な配置場所の選択

- **プロジェクトフック**: `.cursor/hooks.json` と `.cursor/hooks/*`
- **ユーザーフック**: `~/.cursor/hooks.json` と `~/.cursor/hooks/*`

パスの挙動が重要です:

- **プロジェクトフック**はプロジェクトルートから実行されるため、`.cursor/hooks/my-hook.sh` のようなパスを使う
- **ユーザーフック**は `~/.cursor/` から実行されるため、`./hooks/my-hook.sh` や `hooks/my-hook.sh` のようなパスを使う

挙動をリポジトリで共有し、バージョン管理に含めるべき場合は、**プロジェクトフック**を優先してください。

## フックイベントの選択

ユーザーの目的に合致する、最も範囲の狭いイベントを使ってください。

### よく使われる Agent イベント

- `sessionStart`, `sessionEnd`: セッションのセットアップまたは監査
- `preToolUse`, `postToolUse`, `postToolUseFailure`: すべてのツールを横断して動作
- `subagentStart`, `subagentStop`: Task/サブエージェントのワークフローの制御または継続
- `beforeShellExecution`, `afterShellExecution`: ターミナルコマンドのゲートまたは監査
- `beforeMCPExecution`, `afterMCPExecution`: MCP ツール呼び出しのゲートまたは監査
- `beforeReadFile`, `afterFileEdit`: ファイル読み取りの制御、または編集の後処理
- `beforeSubmitPrompt`: プロンプトが送信される前に検証する
- `preCompact`: コンテキストの圧縮を観察する
- `stop`: エージェントの完了を処理する
- `afterAgentResponse`, `afterAgentThought`: エージェントの出力や推論を追跡する

### Tab イベント

- `beforeTabFileRead`: インライン補完のためのファイルアクセスを制御する
- `afterTabFileEdit`: Tab による編集を後処理する

### イベント早見表

- **シェルコマンドのブロックまたは承認** -> `beforeShellExecution`
- **シェル出力の監査** -> `afterShellExecution`
- **編集後のファイルのフォーマット** -> `afterFileEdit`
- **特定のツール呼び出しのブロックまたは書き換え** -> `preToolUse`
- **ツール成功後にフォローアップコンテキストを追加** -> `postToolUse`
- **サブエージェントの実行可否の制御** -> `subagentStart`
- **サブエージェントループの連鎖** -> `subagentStop`
- **プロンプト内のシークレットやポリシー違反のチェック** -> `beforeSubmitPrompt`
- **MCP 呼び出しの保護** -> `beforeMCPExecution`

## フックファイルのフォーマット

スキーマバージョン 1 の `hooks.json` ファイルを作成します:

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      {
        "command": ".cursor/hooks/format.sh"
      }
    ]
  }
}
```

各フック定義には以下を含めることができます:

- `command`: シェルコマンドまたはスクリプトのパス
- `type`: `"command"` または `"prompt"`（デフォルトは `"command"`）
- `timeout`: 秒単位のタイムアウト
- `matcher`: フックを実行する条件のフィルター
- `failClosed`: フックがクラッシュ、タイムアウト、または不正な JSON を返したときにアクションをブロックする
- `loop_limit`: 主に `stop` と `subagentStop` のフォローアップループ用

## Matcher

フックがすべてのイベントで実行されるのを避けるため、matcher を使います。

- `preToolUse` / `postToolUse` / `postToolUseFailure`: `Shell`、`Read`、`Write`、`Task` などのツールタイプ、または `MCP: ...` 形式の MCP ツールにマッチ
- `subagentStart` / `subagentStop`: `generalPurpose`、`explore`、`shell` などのサブエージェントタイプにマッチ
- `beforeShellExecution` / `afterShellExecution`: シェルコマンドの完全な文字列にマッチ
- `beforeReadFile`: `Read` や `TabRead` などのツールタイプにマッチ
- `afterFileEdit`: `Write` や `TabWrite` などのツールタイプにマッチ
- `beforeSubmitPrompt`: 値 `UserPromptSubmit` にマッチ

matcher に関する重要な注意:

- matcher は JavaScript スタイルの正規表現を使う。POSIX/grep の構文ではない
- `[[:space:]]` のような POSIX クラスは使わない。`\s` のような JavaScript の等価表現を使う
- matcher が少しでも扱いにくい場合は、まず matcher なし、または非常にシンプルな matcher でフックを動かし、フックが読み込まれて発火することを確認してから絞り込む

ユーザーが特定の危険なコマンド群のみを対象とするフックを求めている場合、最初に動くバージョンではスクリプト側でのフィルタリングを優先し、matcher はシンプルかつ明らかに正しい場合にのみ後から追加してください。

## コマンドフック

コマンドフックがデフォルトです。stdin で JSON を受け取り、stdout で JSON を返すことができます。

コマンドフックを使う前に、それが依存するすべての実行可能ファイルがフックの実行環境で実際に動くことを確認してください:

- スクリプト自体に有効な shebang があり、実行可能になっている
- スクリプトが呼び出すヘルパーバイナリがすでにインストールされ、`$PATH` 上にある
- スクリプトが `jq`、`python3`、`node`、リポジトリローカルの CLI などのツールに依存する場合は、完了する前にそれを明示的に確認する

自分のマシンで一般的だからといって、バイナリが存在すると仮定しないでください。

### 最小限のプロジェクトレベルの例

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": ".cursor/hooks/approve-network.sh",
        "matcher": "curl|wget|nc ",
        "failClosed": true
      }
    ]
  }
}
```

```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')

if [[ "$command" =~ curl|wget|nc ]]; then
  echo '{
    "permission": "ask",
    "user_message": "This command may make a network request. Please review it before continuing.",
    "agent_message": "A hook flagged this shell command as a possible network call."
  }'
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
```

重要な挙動:

- 終了コード `0`: 成功
- 終了コード `2`: アクションをブロックする。deny を返すのと同じ
- その他の非ゼロ終了コード: `failClosed: true` でない限り、デフォルトでフェイルオープン

フックスクリプトを作成したら、必ず実行可能にしてください。

## プロンプトフック

プロンプトフックは、ポリシーをスクリプト化するより言葉で説明するほうが簡単な場合に有用です。

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "type": "prompt",
        "prompt": "Does this command look safe to execute? Only allow read-only operations. Here is the hook input: $ARGUMENTS",
        "timeout": 10
      }
    ]
  }
}
```

プロンプトフックは、軽量なポリシー判断に使ってください。ロジックが決定論的でなければならない場合や、ユーザーが正確で監査可能な挙動を必要とする場合は、コマンドフックを優先してください。

## イベント出力チートシート

そのイベントがサポートする出力フィールドのみを使ってください。

- `preToolUse`: `permission`、`user_message`、`agent_message`、`updated_input` を返せる
- `postToolUse`: `additional_context` を返せる。MCP ツールの場合はさらに `updated_mcp_tool_output` も返せる
- `subagentStart`: `permission` と `user_message` を返せる
- `subagentStop`: `followup_message` を返せる
- `beforeShellExecution` / `beforeMCPExecution`: `permission`、`user_message`、`agent_message` を返せる

ユーザーがツール呼び出しを書き換えたい場合は `preToolUse` を優先します。シェルコマンドのみをゲートしたい場合は `beforeShellExecution` を優先します。

## 実装ワークフロー

1. 正しい配置場所とイベントを選ぶ
2. 正しい `hooks.json` ファイルを作成または更新する
3. matcher なし、または最もシンプルで安全な matcher から始める
4. 対応する hooks ディレクトリ配下にスクリプトを作成する
5. stdin の JSON を読み取り、必要な挙動を実装する
6. スクリプトを実行可能にする
7. スクリプトが使うヘルパー実行ファイルがインストールされ `$PATH` 上にあることを確認する
8. 該当するアクションを実際に起こしてフックをテストする
9. Cursor の **Hooks** 設定タブまたは **Hooks** 出力チャンネルで挙動を確認する

既存のフック設定を編集している場合は、無関係なフックを保持し、必要最小限のエントリのみを変更してください。

## 検証とトラブルシューティング

- Cursor は `hooks.json` を監視しており、保存時にリロードする
- それでもフックが読み込まれない場合は、Cursor を再起動する
- 相対パスを再確認する:
  - プロジェクトフック -> プロジェクトルートからの相対パス
  - ユーザーフック -> `~/.cursor/` からの相対パス
- フックがまったく読み込まれていないように見える場合は、まず matcher や設定のパースを疑う。matcher を外してベースのフックが動くことを確認してから絞り込む
- スクリプトが外部コマンドを実行する場合は、それぞれがインストールされていて、フックのプロセスから `command -v` などで到達可能なことを確認する
- 失敗時にフックがブロックすべき場合は、`failClosed: true` を設定する
- コマンドフックが意図的にブロックすべき場合は、終了コード `2` を返すのが正しい方法

## 最終チェックリスト

- [ ] 正しいフックの配置場所とパススタイルを使った
- [ ] 最も範囲の狭い正しいイベントを選んだ
- [ ] 適切な場合に matcher を追加した
- [ ] そのフックイベントがサポートするフィールドのみを返した
- [ ] スクリプトを実行可能にした
- [ ] 実際のイベントを発生させてフックをテストした
- [ ] デバッグが必要だった場合は Hooks タブまたは Hooks 出力チャンネルを確認した
