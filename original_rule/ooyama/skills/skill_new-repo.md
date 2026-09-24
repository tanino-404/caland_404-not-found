---
name: new-repo
description: >-
  現在のプロジェクト用に Cursor ホストのリポジトリを作成してプッシュする。
  プロジェクトにまだ git リモートがなく、ユーザーが Cursor 上にリポジトリを
  作りたい、プロジェクトを Cursor にプッシュしたい、Cursor ホストのリモートを
  設定したいと依頼したときに使用する。必要に応じて origin CLI のインストールと
  サインインも行う。
disabled-environments:
  - cloud
---
# new-repo — このプロジェクト用のリポジトリを作成してプッシュする

ユーザーが git に不慣れそうな場合は、語彙を平易に保つこと（`share` スキルは
この同じフローを初心者向けの言い回しにしたもの）— 以下の手順はどちらの場合も
まったく同じです。

このスキルは Cursor ホストのリポジトリを作成します。ユーザーが明示的に別の
ホストを求めた場合は、このスキルを使わずにその依頼に従ってください。

## 1. まずワークスペースを調べる（必ず）

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
git remote -v
```

- **リモートがすでに存在する** → このプロジェクトにはすでにリポジトリがある。
  どのリモートかを伝え、代わりにコミット/プッシュを提案して、そこで止まる。
  リポジトリを持つプロジェクトに 2 つ目のリポジトリを作らないこと。既存の
  リモートを変更しないこと。
- まだ git リポジトリでない → 手順 2 で `git init` する。

デフォルトでは、プロジェクトフォルダにちなんだ名前のリポジトリにする
（小文字、ダッシュ区切り。英字・数字・ダッシュ以外の文字は取り除く）。名前に
ついて尋ねるのは、本当に曖昧な場合だけにすること。

## 2. プロジェクトを準備する

何かをステージする前に、コミットされる予定のものを一覧し
（`git status --porcelain` または `git ls-files -o --exclude-standard`）、
`.gitignore` が依存ディレクトリとシークレット（`.env*`、鍵や認証情報の
ファイル）をカバーしていることを確認する。シークレットらしきものがステージ
されそうな場合は、含める前に確認を取ること — 盲目的にステージしてプッシュ
してはならない。

```bash
git init -b main   # only if not already a repo
git add -A && git commit -m "Initial commit"   # only if nothing committed
```

## 3. Cursor ホストのリポジトリを作成してプッシュする

`origin` が未インストール、未認証、または古い場合は、まず `origin` スキル
（`~/.cursor/skills-cursor/origin/SKILL.md` に同期されている）を呼び出して
インストールとサインインを行い、その後:

```bash
origin repo create <name>
git remote add origin <clone URL printed by create>
git push -u origin main
```

`origin repo create <name>` に org プレフィックスは不要 — CLI がアカウントの
名前空間を解決する。名前が使われている場合は、近い変種を選び（数字の羅列で
はなく単語を後ろに付ける）、1 回だけリトライする。それでも失敗したらユーザー
に尋ねる。名前空間やアクセスのエラーが出た場合は、`origin` スキルのリカバリ
表に従うこと。

リポジトリのページを報告する: `https://cursor.com/codebase/<org>/<name>`
（`<org>/<name>` は `origin repo create` が出力する）。

## 厳守事項

- プロジェクトにすでにリモートがあるときは、決してリポジトリを作らない。
- リポジトリを削除しない。既存のリモートを変更しない。
- Cursor ホストのリポジトリは公開されない — アクセスはリポジトリのページから
  管理するものであり、このスキルからではないため、一般公開できると約束しない
  こと。
