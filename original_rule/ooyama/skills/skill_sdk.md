---
name: sdk
description: >-
  Cursor SDK（TypeScript の `@cursor/sdk` または Python の `cursor-sdk` /
  `cursor_sdk`）の上にアプリ、スクリプト、CI パイプライン、自動化を構築するユーザーを
  ガイドする。ユーザーが Cursor SDK への統合・インストール・コード記述に言及したとき、
  `Agent.create`、`Agent.prompt`、`Agent.resume`、`agent.send`、`run.stream`、
  `run.messages`、`CursorAgentError`、`@cursor/sdk`、`cursor-sdk`、`cursor_sdk` と
  発言したとき、スクリプト・CI/CD パイプライン・GitHub Action・バックエンドサービス
  など Cursor IDE の外側のコードから Cursor エージェントをプログラム的に実行したいと
  依頼したとき、ローカルとクラウドのランタイムの選択、SDK エージェント向け MCP
  サーバーの設定、ストリーミング・キャンセル・エラーの処理をしたいとき、あるいは
  Cursor を自動化・ボット・REST `/v1/agents` からの移行に組み込んでいるときに使用する。
  記憶から答えるのではなく積極的にこのスキルを使うこと。SDK のインターフェースは
  進化しており、このスキルが外部パッケージに関する唯一の正である。
---
# Cursor SDK

Cursor SDK は Cursor エージェントをプログラム的に実行します。2 つの言語バリアントが同じ概念を共有しています:

- **TypeScript**（`@cursor/sdk`、npm）- ドキュメントは [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)
- **Python**（`cursor-sdk`、pip）- ドキュメントは [cursor.com/docs/sdk/python](https://cursor.com/docs/sdk/python)

どちらもパブリックベータであり、ローカル（呼び出し元のマシン上で `cwd` に対して実行）とクラウド（Cursor がホストする VM 上でクローンされたリポジトリに対して実行）の両ランタイムにわたって、同じ `Agent` → `Run` モデルに従います。

このスキルは、誰かが**動く統合をすばやくブートストラップ**し、**新規ユーザーがはまりがちな罠を回避**できるよう支援するために使います。正式なドキュメントが完全なリファレンスをカバーしており、このスキルはその上に意思決定、失敗モードの予防、すぐに拡張できるパターンを追加するものです。

## 言語を選ぶ

コードを書く前に決めること。選択を誤ると統合全体を書き直すことになります。優先順位:

1. **ユーザーが名指しした場合。** `@cursor/sdk`、`cursor-sdk`、`cursor_sdk`、`npm install`、`pip install`、`import { Agent } from "@cursor/sdk"`、`from cursor_sdk import` — ユーザーが名指ししたものに従う。
2. **コードベースが示唆している場合。** `pyproject.toml` / `requirements.txt` / `uv.lock` / `.py` ファイル → Python。`package.json` / `tsconfig.json` / `.ts` ファイル → TypeScript。統合が多言語混在リポジトリに置かれる場合は、どのサブディレクトリに入れるかを尋ねる。
3. **どちらの手がかりもない場合。** 短い質問を 1 つして待つ: *「TypeScript ですか、Python ですか？」* 勝手に選ばないこと。

このスキルの以降では TypeScript と Python を並べて示します。概念は同一で、構文が異なるだけです — camelCase と snake_case、デフォルトで async とデフォルトで sync（async ミラーあり）、`await using` と `with` の違いです。

## 語り口と姿勢

このスキルはユーザーが SDK で**構築する**ことを支援するものです。SDK という選択を承認したり、称賛したり、売り込んだりする場ではありません。ユーザーの意図が入力であり、あなたの仕事は実行です。

- **ユーザーが SDK を明示的に名指しした場合**（「Cursor SDK」、`@cursor/sdk`、`cursor-sdk`、`Agent.create`、`Agent.prompt` などと言った場合）: ユーザーは SDK が何かを知っており、使うと決めていると想定する。前置きも励ましも省略し、統合の作成に直行する。「良いニュースです」も「SDK はこれにぴったりです」も「これはまさに X が想定しているパターンです」も不要。
- **ユーザーが SDK に適した問題を説明しているが名指ししていない場合**（「PR をレビューするボットが欲しい」「リポジトリについて Cursor に質問するスクリプトが欲しい」）: SDK はまだ確定した選択ではない。簡潔に質問として提示し、待つ: *「ここでは Cursor SDK を使うのが良さそうです — その方向で設計しましょうか、それとも別のランタイムをお考えですか？」* 確認が取れたら進める。反対されたり選択肢を求められたら、選択肢を提示する。
- **いずれの場合も、ユーザーの意図をオウム返ししない。** ユーザーは自分が何をしたいか分かっています。設計に入ること。

以下の特定の出だし（およびその類似表現）は避けること:

- 「良いニュースです。これはまさに…のパターンです」
- 「SDK はこの形のために作られています」
- 「素晴らしい、まさに適切な場所に来ましたね」
- 「これはほぼ SDK が想定している X そのものです」
- ユーザーの選択を褒めたり、目標を持ち上げた言い方で言い直したりするあらゆる導入。

代わりに:

- 設計上の決定事項、またはユーザーが最初に知るべきことから始める。
- 本当に指摘すべき設計上の選択がある場合（ローカル対クラウド、prompt 対 send、sync 対 stream、sync Python 対 async Python）は、一文で名指しし、理由を説明する。

## 3 つの呼び出しパターン

SDK 統合のほぼすべては、この 3 つの形のいずれかに収束します。仕事に合うものを 1 つ選び、混ぜないこと。

### 1. `Agent.prompt(...)` - ワンショット

投げっぱなしのスクリプト、GitHub Actions のステップ、その他「このプロンプトを送り、結果を得て、終了する」フローに使う。ストリーミングなし、フォローアップなし、覚えておくべきクリーンアップなし。これを使おうとしてすぐに resume したくなったら、本当に必要なのはパターン 2 です。

**TypeScript:**

```typescript
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt("Refactor src/utils.ts for readability", {
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd() },
});
console.log(result.status, result.result);
```

**Python:**

```python
import os
from cursor_sdk import Agent, AgentOptions, LocalAgentOptions

result = Agent.prompt(
    "Refactor src/utils.py for readability",
    AgentOptions(
        api_key=os.environ["CURSOR_API_KEY"],
        model="composer-2.5",
        local=LocalAgentOptions(cwd=os.getcwd()),
    ),
)
print(result.status, result.result)
```

### 2. `Agent.create(...)` + `agent.send(...)` - フォローアップ可能な永続型

ストリーミング、複数ターンの会話、ライフサイクル操作（キャンセル、ステータスリスナー）が必要なときに使う。これが自明でない統合のほとんどの形です。

**TypeScript:**

```typescript
import { Agent } from "@cursor/sdk";

await using agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  local: { cwd: process.cwd() },
});

const run = await agent.send("Find the bug in src/auth.ts");
for await (const event of run.stream()) {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "text") process.stdout.write(block.text);
    }
  }
}
await run.wait();

// Follow-up keeps full conversation context.
const run2 = await agent.send("Now write a regression test for it");
await run2.wait();
```

**Python:**

```python
import os
from cursor_sdk import Agent, LocalAgentOptions

with Agent.create(
    model="composer-2.5",
    api_key=os.environ["CURSOR_API_KEY"],
    local=LocalAgentOptions(cwd=os.getcwd()),
) as agent:
    run = agent.send("Find the bug in src/auth.py")
    for message in run.messages():
        if message.type == "assistant":
            for block in message.message.content:
                if block.type == "text":
                    print(block.text, end="")
    run.wait()

    # Follow-up keeps full conversation context.
    run2 = agent.send("Now write a regression test for it")
    run2.wait()
```

Python SDK はデフォルトで sync です。サーバー、ボット、並行オーケストレーションには、非同期コンテキストマネージャーとして `AsyncClient.launch_bridge(...)` と `AsyncAgent` を使います。グローバルな async デフォルトクライアントは存在しません — イベントループごとに 1 つインスタンス化し、同じコードパスで sync クライアントと async クライアントを決して混ぜないこと。

### 3. `Agent.resume(...)` - 既存のエージェントを後から再開

プロセス境界をまたぐ場合に使う: 昨夜のクリーンアップを続行する cron、ユーザーのエージェントを延長する webhook、会話状態を再読み込みする対話型 CLI など。ランタイムは ID のプレフィックスから自動判別されます — `bc-` はクラウド、それ以外はローカル。

**TypeScript:**

```typescript
await using agent = await Agent.resume(previousAgentId, {
  apiKey: process.env.CURSOR_API_KEY!,
});
const run = await agent.send("Also update the changelog");
await run.wait();
```

**Python:**

```python
import os
from cursor_sdk import Agent, AgentOptions

with Agent.resume(
    previous_agent_id,
    AgentOptions(api_key=os.environ["CURSOR_API_KEY"]),
) as agent:
    run = agent.send("Also update the changelog")
    run.wait()
```

**インラインの MCP サーバーは resume をまたいで永続化されません** — シークレットを含むことが多く、メモリ上にのみ存在するためです。どちらの言語でも、resume 呼び出し時にサーバーを再度渡してください。

## 5 大トラップ

ほぼすべての新規統合がこれらに引っかかります。知ってさえいれば、どれも簡単に防げます。

### 1. 意図せず間違ったランタイムを選んでしまう

`AgentOptions` は `local` も `cloud` も必須ではなく、どちらも未設定なら SDK はローカルを選択します。罠はここです: クラウドエージェントを意図していて `cloud` フィールドを忘れると、何のエラーもなく静かにローカルエージェントになります — ローカルのエージェント ID とローカルの実行環境が返るだけです。

- **TypeScript:** クラウドなら `cloud: { repos: [...] }`、ローカルなら `local: { cwd }` を渡す — ローカルがデフォルトであっても。
- **Python:** `cloud=CloudAgentOptions(repos=[...])` または `local=LocalAgentOptions(cwd=...)` を渡す。

必ずどちらか一方を明示的に設定すること。コストは 1 行ですが、1 時間気づかないコストははるかに大きい。

### 2. 2 種類の失敗を混同してしまう本能

throw された `CursorAgentError` は、run が**一度も実行されなかった**ことを意味します（認証、設定、ネットワーク）。返り値の `result.status == "error"` は、run が**実行されたうえで失敗した**ことを意味します。修正方法も、終了コードも、可観測性も異なります。

**TypeScript:**

```typescript
import { Agent, CursorAgentError } from "@cursor/sdk";

try {
  const run = await agent.send(prompt);
  const result = await run.wait();
  if (result.status === "error") {
    // Run started but failed mid-flight. Inspect transcript, git state, tool outputs.
    console.error("run failed: " + result.id);
    process.exit(2);
  }
} catch (err) {
  if (err instanceof CursorAgentError) {
    // Didn't start. Auth, config, network. Fix environment, retry.
    console.error("startup failed: " + err.message + ", retryable=" + err.isRetryable);
    process.exit(1);
  }
  throw err;
}
```

**Python:**

```python
import sys
from cursor_sdk import CursorAgentError

try:
    run = agent.send(prompt)
    result = run.wait()
    if result.status == "error":
        # Run started but failed mid-flight. Inspect transcript, git state, tool outputs.
        print("run failed: " + result.id, file=sys.stderr)
        sys.exit(2)
except CursorAgentError as err:
    # Didn't start. Auth, config, network. Fix environment, retry.
    print(
        "startup failed: " + err.message + ", retryable=" + str(err.is_retryable),
        file=sys.stderr,
    )
    sys.exit(1)
```

### 3. dispose を忘れるとリソースがリークする

SDK はローカル実行環境、永続化された run ストア、HTTP クライアントへのハンドルを保持します。破棄を省略すると、子プロセス、開いたままのデータベース、（長時間稼働するサービスでは）メモリがリークします。

- **TypeScript:** `await using agent = await Agent.create(...)` が最もクリーンな方法。それ以外では `try/finally` で包み、`await agent[Symbol.asyncDispose]()` を呼ぶ。`Agent.prompt(...)` は自動で破棄してくれる。
- **Python（sync）:** `with Agent.create(...) as agent:` が最もクリーンな方法。それ以外では `finally` の中で `agent.close()` を呼ぶ。モジュールレベルのデフォルトクライアントに依存する長時間稼働プロセスは、シャットダウン時に `close_default_client()` を呼ぶこと。
- **Python（async）:** 2 つの非同期コンテキストマネージャーをネストする — `async with await AsyncClient.launch_bridge(...) as client:` の中で `async with await client.agents.create(...) as agent:`。`Agent.prompt(...)` は自動で破棄してくれる。

### 4. ストリーミングは任意だが `wait()` はほぼ必須

ストリームは観測の手段であり、`wait()` は最終結果を得る手段です。ストリーミングは省略できますが、`wait()` を省略すると、run が完了したのか、エラーになったのか、キャンセルされたのかが分からず、run の内部ウォッチャーがリークします。必ず `wait()` を呼ぶこと。ライブ出力が不要なら `wait()` だけを呼べばよい。

- **TypeScript:** `run.stream()` は `SDKMessage` の非同期イテラブル。`await run.wait()` は `RunResult` を返す。
- **Python:** `run.messages()` は型付きの SDK メッセージを yield し、`run.events()` はより低レベルのエンベロープを yield する。`run.wait()` は `RunResult` を返す。async 版は `async for ...` と `await run.wait()`。便利ヘルパー: `run.text()` は `wait()` をブロックして最終的なアシスタントのテキストを返し、`run.iter_text()` はテキストのみのチャンクをストリームする。`run.stream()` は `run.messages()` のエイリアス。

### 5. すべての `run` 操作がすべてのランタイムでサポートされているわけではない

`Run` は一握りの操作 — stream/messages、wait、cancel、conversation — を公開しますが、デタッチされた run や再構築された run（ライブのイベントストアが閉じた後に `Agent.getRun(...)` から取得したハンドル）は、そのすべてをサポートしているとは限りません。`supports(...)` でガードすること:

```typescript
if (run.supports("cancel")) await run.cancel();
if (run.supports("conversation")) console.log(await run.conversation());
```

```python
if run.supports("cancel"):
    run.cancel()
if run.supports("conversation"):
    print(run.conversation())
```

`run.unsupportedReason(op)`（TypeScript）/ `run.unsupported_reason(op)`（Python）が理由を教えてくれます。

## ローカル対クラウドを一文ずつで

- **ローカル** - 呼び出し元のマシン上で `cwd` に対して実行され、そのマシンの環境と認証情報を再利用する。開発ループや、すでにリポジトリのチェックアウトがある CI に向く。
- **クラウド** - Cursor がホストする VM 上で、新しくクローンされたリポジトリに対して実行される。長時間ジョブ、投げっぱなしの自動化、実際の PR 作成（TypeScript では `autoCreatePR: true`、Python では `auto_create_pr=True`）に向く。

## 認証、最小構成

```bash
export CURSOR_API_KEY="cursor_..."  # user API key or team service-account key
```

どちらの SDK も、キーが明示的に渡されないときは `CURSOR_API_KEY` を読みます。ユーザーキーは [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)、チームのサービスアカウントキーは Team Settings → Service accounts にあります。Team Admin API キーはまだサポートされていません。

401 が出る場合、よくある原因は次のとおり: キーの前後に空白が混入している、別の環境で発行されたキーを使っている、クラウド実行でキーの持ち主にリポジトリへのアクセス権がない。

## モデルの選択

呼び出し元がアクセスできると確認せずに、珍しいモデル ID をハードコードしないこと — モデルの一覧は変化します。

**TypeScript:**

```typescript
import { Cursor } from "@cursor/sdk";

const models = await Cursor.models.list({ apiKey: process.env.CURSOR_API_KEY! });
```

**Python:**

```python
from cursor_sdk import Cursor

models = Cursor.models.list()  # falls back to CURSOR_API_KEY
```

`composer-2.5` がほとんどの統合における現在のデフォルトです。`{ id: "auto" }`（TS）/ `model="auto"`（Python）でサーバーに選ばせることもできます。`Cursor.models.list()` は、有効な ID、モデルごとのパラメータ定義（reasoning effort、max mode）、呼び出しアカウント向けのプリセットバリアントを返します。

モデルは両 SDK とも**ローカルでは必須**です。クラウドでは、TypeScript は省略時にサーバー側で解決されるデフォルトにフォールバックしますが、Python は両ランタイムで必須と文書化されています。挙動を予測可能に保つため、いずれの場合も渡すこと。

## MCP サーバー

どちらの SDK も同じ概念モデルを使います: HTTP トランスポート（静的な `headers` または OAuth の `auth` 付き）か、stdio（`command` / `args` / `env` 付き）。最も一般的なケースでは、`Agent.create` または `agent.send` にサーバーをインラインで渡します。

- **ローカルエージェント**は、呼び出し元のマシンで利用可能な stdio または HTTP サーバーを使えます。ローカルの MCP サーバーが OAuth ログインを必要とする場合、SDK は Cursor アプリに保存されたログインを再利用できますが、サインインのためにブラウザを開くことはできません。
- **クラウドエージェント**は HTTP と stdio の両方をサポートします（stdio はクラウド VM の内部で実行されます）。HTTP の `headers` と `auth` は Cursor のバックエンドで処理され、VM から見える前に秘匿化されます。stdio の `env` 値は VM に渡されます — 他のランタイムシークレットと同様に扱うこと。
- **send ごとの上書きでは、インラインのサーバーは作成時のサーバーを完全に置き換えます — マージされません。**
- **エージェントを resume して MCP ツールが引き続き必要なら、resume 呼び出し時にサーバーを再度渡すこと。** インラインのサーバーは永続化されません。

完全なスキーマと認証オプションについては、各言語の SDK ドキュメントと [Cursor MCP](https://cursor.com/docs/mcp) を参照してください。

## 本番環境のベストプラクティス

無人で稼働するあらゆる統合に、以下を適用すること:

1. **必ず dispose する。** `await using`（TypeScript）または `with ... as agent:`（Python）が最もクリーンな方法。交渉の余地なし。
2. **起動時の失敗と実行中の失敗を区別する。** throw された `CursorAgentError` には終了コード 1、`result.status == "error"` には終了コード 2、`finished` のときだけ終了コード 0。
3. **`send()` の直後、ストリーミングを始める前に `run.id` と `agent.agentId` / `agent.agent_id` をログする。** ストリームがハングした場合、ダッシュボードや `Agent.getRun(...)` / `Agent.get_run(...)` で調査するのに必要なのはこれらの ID。
4. **`error.isRetryable` / `err.is_retryable` を尊重する。** これはバックエンドが「この失敗はリトライしても安全」と伝えているもの。Python のエラーは `retry_after`（HTTP 形式の秒数または日時）も公開する — 指数バックオフにフォールバックする前にこれを守ること。盲目的なリトライはクラウド実行の重複を招きうる。
5. **意図しない限りアンビエント設定を読み込まない。** TypeScript のデフォルトは `local.settingSources: []`、Python のデフォルトは `local.setting_sources` 未指定。どちらも「インライン設定のみ」を意味する。`"all"` を選ぶと、呼び出し元の環境からプロジェクト/ユーザー/チーム/MDM の設定が読み込まれるが、サービスからそれを望むことはまれ。設定ソースはクラウドエージェントには影響しない — クラウドは常にチーム/プロジェクト/プラグインの設定に従う。
6. **CI のクラウドエージェントでは、人間に通知すべき場合を除き `skipReviewerRequest: true`（TypeScript）/ `skip_reviewer_request=True`（Python）を設定する** — レビュアーリクエストのステップが抑制され、PR 通知が静かになる。
7. **共有インフラのコードでは、環境変数に頼らず常に `apiKey` / `api_key` を明示的に渡す。** 認証情報への依存が明確になり、テナント間の取り違えを防げる。
8. **本当のワンショットには一発実行の `Agent.prompt(...)` を推奨** — 自動で破棄され、リークしにくい。

## 自分が起動していない run を観測する

任意のエージェントや run は、後から ID で調べられます。`bc-` で始まるクラウド ID は自動的にクラウド API にルーティングされ、それ以外はローカルです。

**TypeScript:**

```typescript
const info = await Agent.get("bc-abc123", { apiKey });
const run = await Agent.getRun(runId, { runtime: "cloud", agentId: "bc-abc123", apiKey });

// Local: you need the cwd where the agent was created.
const localList = await Agent.list({ runtime: "local", cwd: process.cwd() });
```

**Python:**

```python
from cursor_sdk import CursorClient

with CursorClient.launch_bridge(workspace=".") as client:
    info = client.agents.get("bc-abc123")
    run = client.agents.get_run(run_id)

    # Local: filter by cwd.
    local_list = client.agents.list(runtime="local", cwd=".")
```

`bc-` プレフィックス付きのクラウドエージェント ID は run ID では**ありません**。run ID しか手元にない場合（ログや webhook から得た場合）は、ランタイムのヒントを添えて `getRun` / `get_run` に渡すこと。2 つを混同しないように。

## Canvas の提案

ユーザーの統合がエージェントを監視・一覧表示・可視化するもの — アクティブな run のダッシュボード、会話のリプレイ、ツール呼び出しのタイムラインなど — であれば、それを描画する Cursor Canvas を提案すること。受け入れられた場合は、`canvas` スキルに全面的に委ねる。

## このスキルがカバーしないもの

- [Cloud Agents REST API](https://cursor.com/docs/cloud-agent/api/endpoints)（`/v1/agents/*`）。ファーストパーティ SDK がない言語から使う場合や、最小限の HTTP インターフェースが欲しい場合に使う。
- `.cursor/hooks.json` のフック。両 SDK ともフックを尊重するが、管理はしない。[Hooks](https://cursor.com/docs/hooks) を参照。
- セルフホストのクラウド（プライベートワーカー、セルフホストプール、my-machines）。[Self-hosted pool](https://cursor.com/docs/cloud-agent/self-hosted-pool) と関連ドキュメントを参照。
- TypeScript と Python 以外の言語の SDK。そこではポータブルな選択肢は REST API。
