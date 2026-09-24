---
name: vercel-composition-patterns
description: 規模に耐える React の合成パターン。boolean props が増えたコンポーネントの組み替え、再利用 API、compound component、render props、Context のときに使う。React 19 の API 変更も含む。Use when refactoring boolean props, compound components, render props, context, or component APIs.
license: MIT
metadata:
  author: vercel
  version: '1.0.0'
---

# React 合成パターン

柔軟で保守しやすい React コンポーネントのための合成パターン。boolean props の増殖を避け、compound component、state の持ち上げ、内部の合成を使う。人が読んでもエージェントが触っても、規模に耐えるコードになる。

## 使うとき

次のときに参照する。

- boolean props が多いコンポーネントを直す
- 再利用するコンポーネントライブラリを組む
- 柔軟なコンポーネント API を設計する
- コンポーネント構成をレビューする
- compound component や Context provider を扱う

## 優先度別カテゴリ

| 優先度 | カテゴリ | 影響 | 接頭辞 |
| -------- | ----------------------- | ------ | --------------- |
| 1        | コンポーネント構成 | HIGH   | `architecture-` |
| 2        | 状態管理 | MEDIUM | `state-`        |
| 3        | 実装パターン | MEDIUM | `patterns-`     |
| 4        | React 19 API | MEDIUM | `react19-`      |

## 早見表

ルール ID はファイル名と一致する。詳細は `rules/<id>.md` を読む。

### 1. コンポーネント構成 (HIGH)

- `architecture-avoid-boolean-props` - 振る舞いの切り替えに boolean props を足さない。合成する
- `architecture-compound-components` - 複雑なコンポーネントは共有 Context で組む

### 2. 状態管理 (MEDIUM)

- `state-decouple-implementation` - 状態の持ち方を知っているのは Provider だけにする
- `state-context-interface` - 依存注入用に state / actions / meta の汎用インタフェースを置く
- `state-lift-state` - 兄弟から触る状態は provider コンポーネントへ移す

### 3. 実装パターン (MEDIUM)

- `patterns-explicit-variants` - boolean のモードではなく、明示的なバリアントコンポーネントを作る
- `patterns-children-over-render-props` - 合成は renderX props ではなく children を使う

### 4. React 19 API (MEDIUM)

> **React 19 以降のみ。** React 18 以前ならこの節は飛ばす。

- `react19-no-forwardref` - `forwardRef` を使わない。`useContext()` の代わりに `use()` を使う

## 使い方

詳細とコード例は個別ルールファイルを読む。

```
rules/architecture-avoid-boolean-props.md
rules/state-context-interface.md
```

各ルールファイルの構成：

- なぜ重要かの短い説明
- 誤ったコード例と説明
- 正しいコード例と説明
- 追加の文脈と参照

## 全文

全ルールを展開した文書は `AGENTS.md`。

本プロジェクトでは、boolean props が 3 つ以上に増えたコンポーネントにこのスキルを適用する。最初から細かく分けすぎない。
