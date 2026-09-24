---
name: origin
description: >-
  Cursor でホストされているリポジトリ（origin.cursor.com）用の origin CLI を
  インストール、サインイン、更新、修復する。CLI が見つからない・古い場合、
  git push/pull が origin.cursor.com への認証に失敗する場合、または Cursor ホストの
  リポジトリのセットアップ・クローン・設定を求められた場合に使う。
disabled-environments:
  - cloud
---
# origin — origin CLI のセットアップと修復

Cursor は `origin.cursor.com` で git リポジトリをホストしています。`origin` CLI が
それらを管理します。このスキルは、CLI を動作させることと、よくある失敗状態からの
復旧を扱います。Cursor ホストのリポジトリを使うか *どうか* を決めるものではありません —
それはワークフロースキルとユーザーが決めます。

## まずプラットフォームを確認

サポート対象: macOS と Linux（WSL を含む）。ネイティブ Windows（WSL 外）では、
Origin のリポジトリ操作はまだサポートされていません — その旨を率直に伝えてください。
Windows 向けのインストールを即興で行わないこと。

## 1. 現在の状態を検出する

```bash
command -v origin || { test -x ~/.local/bin/origin && echo ~/.local/bin/origin; }
origin auth status
```

- バイナリがない → インストール（ステップ 2）、次に認証（ステップ 3）。
- バイナリはあるが `auth status` にセッションがない → 認証（ステップ 3）。
- 両方問題なし → セットアップは不要。もとの作業を続ける。

`origin` が PATH 上になくても `~/.local/bin/origin` が存在する場合は、
その絶対パスで呼び出してください。

## 2. インストール

```bash
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
```

インストーラーはダウンロードのチェックサムを検証し、`~/.local/bin/origin` に
シンボリックリンクを作成します。新しいシェルではまだ `~/.local/bin` が PATH に
ないことがあります — セッションの残りは絶対パスを使ってください。

## 3. 認証

```bash
origin auth login
```

これはユーザーのブラウザを開き（既に持っている Cursor のログインと同じ —
ほとんどのユーザーはワンクリック）、`origin.cursor.com` 用の git 認証ヘルパーを
設定します。以降は追加のセットアップなしで `git push`/`git pull` が動作します。
コマンドの完了を待ってください。

- ヘッドレスまたは SSH セッション: CLI はブラウザを開く代わりにログイン URL を
  表示します。その URL をユーザーに示して待ってください。
- ユーザーにトークンをチャットに貼り付けるよう求めたり、認証情報を表示したり
  しないこと。CLI は OS のキーチェーン / 自身の認証情報ファイルに保存します。

## 4. 既知の失敗からの復旧

| 失敗のシグネチャ | 対処 |
| --- | --- |
| `origin: command not found` | インストール（ステップ 2）。 |
| git push/pull で `Authentication failed for 'https://origin.cursor.com/...'` | `origin auth status`、次に `origin auth login`、その後 git コマンドを再試行。 |
| アカウントに Origin の名前空間がない（`origin repo create` / `repo list` で名前空間欠落に言及するエラー） | エラー自体の案内を平易な言葉で伝える。チーム所属のユーザーの場合、チーム管理者が cursor.com/codebase で名前空間をセットアップする。このセッションでは再試行しない。 |
| 名前空間へのアクセス権がない | ユーザーのチームは Origin を持っているが、このアカウントにはそこでのリポジトリアクセス権がない — チーム管理者が付与できる。 |
| `origin auth login` が完了しない | ユーザーがブラウザでの手続きを完了していない。完了するかコマンドの再実行を依頼する。回避策を取らないこと。 |

動作しているインストールを再インストールすることはありません。`origin update` は
CLI 自身の更新ヒントが提案したときにのみ実行します。更新に失敗した場合は、
インストーラー（ステップ 2）を再実行してください。

## 動作したら使える便利なコマンド

- `origin repo clone <org>/<name>` — 保存されたログインを使って Cursor ホストの
  リポジトリをクローンする（以降の git push/pull は `origin auth login` が設定した
  認証ヘルパーに依存する）。
- `origin repo list` — アカウントがアクセスできるリポジトリを一覧する。
- `origin repo create <name>` — リポジトリを作成する。CLI がアカウントの名前空間を
  自動的に解決するので org プレフィックスは不要（名前空間の失敗は上の復旧テーブルを
  参照）。

## 厳守事項

- ユーザーがそのリポジトリの削除を明示的に依頼し、正確なリポジトリ名を確認済みで
  ない限り、`origin repo delete` を決して実行しない。
- 既存のリモートを置き換えたり書き換えたりしない。
