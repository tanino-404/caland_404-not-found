---
name: web-design-guidelines
description: UI コードを Web Interface Guidelines に照らして監査する。「UI を見直して」「デザインを確認して」「アクセシビリティ」「UX を見て」と言われたときに使う。Use when reviewing UI, accessibility, UX, or design best practices.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

ファイルを Web Interface Guidelines への適合で監査する。

## 手順

1. 下記 URL から最新ガイドラインを取得する
2. 指定されたファイルを読む（無ければ人間にファイル／パターンを聞く）
3. 取得したルールすべてに照らして確認する
4. 指摘は簡潔な `file:line` 形式で出す

## ガイドラインの取得元

監査のたびに最新を取る。

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

WebFetch で最新ルールを取る。取得内容にルールと出力形式の指示が入っている。

## 使い方

人間がファイルまたはパターンを渡したとき：
1. 上記 URL からガイドラインを取得する
2. 指定ファイルを読む
3. ガイドラインの全ルールを適用する
4. ガイドライン指定の形式で指摘を出す

ファイル指定が無ければ、どれを見るか人間に聞く。

本プロジェクトでは、指摘のうち「見た目・操作の下限」に関わるものだけを直す。見た目のインパクトを削る方向の指摘は、人間に理由を添えて確認してから対応する。
