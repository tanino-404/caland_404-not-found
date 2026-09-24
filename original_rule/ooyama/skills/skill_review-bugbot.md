---
name: review-bugbot
description: Bugbot サブエージェントでコード変更をレビューする。
---
# Review Bugbot

ユーザーが `/review-bugbot` の実行を求めたときにこのスキルを使います。

`bugbot` サブエージェントをちょうど 1 つ、以下の設定で起動します:

- `run_in_background: false`（バックグラウンド実行を明示的に求められた場合を除く）
- `description: "Bugbot"`
- `subagent_type: "bugbot"`

レビューサブエージェントはリポジトリパスからローカル diff を計算するので、起動前に自分で diff を計算しないでください。リポジトリパスは、ユーザーがレビューしてほしいコードのアクティブなワークスペースまたはリポジトリのルートにします。

デフォルトでは、レビューサブエージェントは `branch changes` を計算する際に、`main` などリポジトリの実際のベースブランチを推測します。ほとんどの場合、`Base Branch` は指定しないでください。現在のブランチや PR を、リポジトリのデフォルトのベースブランチ以外の特定のブランチと比較すべきだと分かっている場合（例えば現在のブランチを別のブランチから作成した場合）にのみ指定します。

特殊ケース: ユーザーが特定の PR やブランチのレビューを明示的に求めた場合は、サブエージェントを起動する前にそのターゲットがチェックアウトされていることを確認します:
- 例: `github.com/... /review`、`review {link}`、`review {branch-name}`。
- 指定された PR リンク、PR 番号、ブランチ名を、PR の head ブランチまたは指定ブランチに解決する。
- ターゲットブランチが既に現在チェックアウトされているローカルブランチかどうかを確認する。そうであれば続行する。
- 別のブランチがチェックアウトされている場合は、ターゲットブランチへの切り替えを試みる。
- ローカルファイルが上書きされる、コンフリクトの解決が必要、その他のチェックアウトの阻害要因により Git が切り替えを拒否した場合は、阻害要因を説明し、再試行の前にローカル変更を stash するかどうかをユーザーに尋ねる。
- stash はユーザーが確認した後にのみ行う。stash が成功したら、ターゲットブランチへの切り替えを再試行する。
- ターゲットブランチがローカルでチェックアウトされた後にのみ、レビューサブエージェントを起動する。

正確に次のプロンプト形式を使います:

```text
Full Repository Path: <absolute repository path>
Diff: <one of: "branch changes", "uncommitted changes", "natural language">
Base Branch: <only include this line when reviewing branch changes against a known specific base branch>
Change Description: <required only when Diff is "natural language"; list each changed file and what changed in it>
Custom Instructions: <only include this line when the user gave specific review instructions>
```

デフォルトは `branch changes` で、デフォルト / ベースブランチとの merge-base に対するブランチの変更を、コミット済み・ステージ済み・未ステージの変更を含めてレビューします。ユーザーが未コミット、ローカルの作業ツリー、dirty、コミット前の変更のみのレビューを求めた場合は、`uncommitted changes` を使います。

レビューサブエージェントが所見を出す前に失敗した場合は、失敗のテキストを調べてください。

- 失敗の原因がサブエージェントの呼び出し方の誤り（`Full Repository Path` の欠落、`Diff` の欠落、プロンプト形式の誤り、サブエージェントタイプの誤りなど）であれば、呼び出しを修正して直ちに 1 回だけ再試行する。
- サブエージェントが diff を計算できなかったと報告した場合（例えば diff が空、diff メタデータの欠落、diff を計算できなかったという報告）、`Diff: natural language` で 1 回だけ再試行し、`Base Branch` は省略して `Change Description` を提供する。サブエージェントはそれらのファイルを直接読む。これはあくまで最終手段であり、通常の diff ベースのレビューが diff を計算できずに失敗した後にのみ使うこと。

  `Change Description` は、変更ファイルごとに 1 ブロックで書く: `<path> (added|modified|deleted|renamed)` のヘッダーに続けて、何が変わったかの箇条書き。役立ち、かつ分かっている場合は行番号や範囲をインラインで記載する（例: `(L40-58)` や `around L120`）。これらは任意であり、すべての箇条書きに必須ではない。例:

  ```text
  src/auth/login.ts (modified):
  - rewrote validateSession (L40-58) to check token expiry before the DB lookup
  - removed the fallback that accepted empty tokens

  src/auth/legacy.ts (deleted)

  src/auth/mfa.ts (added):
  - new verifyMfaCode() (L1-30) that calls the TOTP service and rate-limits attempts
  ```
- その他のサブエージェントの失敗については、同じプロンプト形式で 1 回だけ再試行する。
- 再試行後も同じ失敗が続く場合は停止する。レビューサブエージェントが完了できなかったことを、短いエラーまたは阻害要因とともにユーザーに簡潔に伝える。再試行を続けないこと。

サブエージェントが終了したら、結果を要約します:

- diff が見つからない、または diff が空と報告された場合は、レビュー対象の diff がなかったことを 1 文でユーザーに伝える。
- 問題が見つからなかった場合は、「Bugbot found 2 findings / Bugbot found no bugs」のような 1 行のステータスを伝える。
- 問題が見つかった場合は、所見 1 件につき 1 行の簡潔な markdown テーブルを、重大度の高い順にソートして表示する。列は正確に次のとおり: Severity、Location (file:line)、Finding。Location 列にはファイルと行を `file:line` の形式で入れる。

ユーザーが明示的に次のステップとして求めない限り、所見の修正やレビューの再実行は行わないでください。
