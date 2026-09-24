---
name: vercel-react-best-practices
description: React / Next.js の性能ルール（Vercel Engineering）。コンポーネント作成、データ取得、バンドル、再レンダリング、パフォーマンス改善のときに使う。Use when writing, reviewing, or refactoring React/Next.js for performance, data fetching, or bundle size.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Vercel が維持する、React / Next.js 向けの性能最適化ガイド。影響の大きい順に、8カテゴリ・70ルール。自動リファクタとコード生成の指針にする。

## 使うとき

次のときに参照する。
- 新しい React コンポーネントや Next.js ページを書く
- データ取得を実装する（クライアント／サーバ）
- 性能の問題をレビューする
- 既存の React / Next.js を直す
- バンドルサイズや読み込み時間を減らす

## 優先度別カテゴリ

| 優先度 | カテゴリ | 影響 | 接頭辞 |
|----------|----------|--------|--------|
| 1 | ウォーターフォールの排除 | CRITICAL | `async-` |
| 2 | バンドルサイズ | CRITICAL | `bundle-` |
| 3 | サーバ側の性能 | HIGH | `server-` |
| 4 | クライアント側データ取得 | MEDIUM-HIGH | `client-` |
| 5 | 再レンダリング | MEDIUM | `rerender-` |
| 6 | 描画性能 | MEDIUM | `rendering-` |
| 7 | JavaScript 性能 | LOW-MEDIUM | `js-` |
| 8 | 応用パターン | LOW | `advanced-` |

## 早見表

ルール ID はファイル名と一致する。詳細は `rules/<id>.md` を読む。

### 1. ウォーターフォールの排除 (CRITICAL)

- `async-cheap-condition-before-await` - フラグや遠隔値を await する前に、安い同期条件を先に見る
- `async-defer-await` - 実際に使う分岐の中へ await を移す
- `async-parallel` - 独立した処理は Promise.all()
- `async-dependencies` - 部分依存は better-all
- `async-api-routes` - API ルートでは Promise を早く始め、遅く await する
- `async-suspense-boundaries` - コンテンツのストリームに Suspense を使う

### 2. バンドルサイズ (CRITICAL)

- `bundle-barrel-imports` - barrel ファイルを避け、直接 import する
- `bundle-analyzable-paths` - 広いバンドルを避けるため、静的解析できる import / パスを優先する
- `bundle-dynamic-imports` - 重いコンポーネントは next/dynamic
- `bundle-defer-third-party` - 解析・ログは hydration の後に読む
- `bundle-conditional` - 機能が有効なときだけモジュールを読む
- `bundle-preload` - hover / focus で preload し、体感速度を上げる

### 3. サーバ側の性能 (HIGH)

- `server-auth-actions` - Server Action も API ルートと同様に認証する
- `server-cache-react` - リクエスト内の重複排除に React.cache()
- `server-cache-lru` - リクエストをまたぐキャッシュに LRU
- `server-dedup-props` - RSC props の重複シリアライズを避ける
- `server-hoist-static-io` - フォントやロゴなど静的 I/O をモジュール先頭へ
- `server-no-shared-module-state` - RSC / SSR でモジュール先頭の可変なリクエスト状態を持たない
- `server-serialization` - クライアントへ渡すデータを最小にする
- `server-parallel-fetching` - 取得が並列になるようコンポーネントを組み直す
- `server-parallel-nested-fetching` - ネストした取得をアイテムごとに Promise.all で繋ぐ
- `server-after-nonblocking` - ブロックしない処理は after()

### 4. クライアント側データ取得 (MEDIUM-HIGH)

- `client-swr-dedup` - リクエスト重複排除に SWR
- `client-event-listeners` - グローバルイベントリスナーの重複を除く
- `client-passive-event-listeners` - スクロールは passive リスナー
- `client-localstorage-schema` - localStorage は版管理し、量を最小にする

### 5. 再レンダリング (MEDIUM)

- `rerender-defer-reads` - コールバック内でしか使わない state を購読しない
- `rerender-memo` - 高い処理はメモ化したコンポーネントへ切り出す
- `rerender-memo-with-default-value` - 非プリミティブな default props は外へ出す
- `rerender-dependencies` - effect の依存はプリミティブにする
- `rerender-derived-state` - 生値ではなく、派生した boolean を購読する
- `rerender-derived-state-no-effect` - 派生 state は effect ではなく render 中に作る
- `rerender-functional-setstate` - 安定したコールバックには関数型 setState
- `rerender-lazy-state-init` - 高い初期値は useState に関数を渡す
- `rerender-simple-expression-in-memo` - 単純なプリミティブに memo は使わない
- `rerender-split-combined-hooks` - 独立した依存を持つ hook は分ける
- `rerender-move-effect-to-event` - 操作ロジックはイベントハンドラへ
- `rerender-transitions` - 急がない更新は startTransition
- `rerender-use-deferred-value` - 高い描画を遅らせ、入力を止めない
- `rerender-use-ref-transient-values` - 頻繁に変わる一時値は ref
- `rerender-no-inline-components` - コンポーネントの中でコンポーネントを定義しない

### 6. 描画性能 (MEDIUM)

- `rendering-animate-svg-wrapper` - SVG 要素ではなくラップした div を動かす
- `rendering-content-visibility` - 長いリストは content-visibility
- `rendering-hoist-jsx` - 静的 JSX はコンポーネントの外へ
- `rendering-svg-precision` - SVG 座標の精度を落とす
- `rendering-hydration-no-flicker` - クライアント専用データはインラインスクリプト
- `rendering-hydration-suppress-warning` - 想定どおりの不一致は抑制する
- `rendering-activity` - 表示／非表示は Activity コンポーネント
- `rendering-conditional-render` - 条件付き描画は && ではなく三項演算子
- `rendering-usetransition-loading` - ローディング状態は useTransition を優先
- `rendering-resource-hints` - preload は React DOM の resource hints
- `rendering-script-defer-async` - script タグは defer または async

### 7. JavaScript 性能 (LOW-MEDIUM)

- `js-batch-dom-css` - CSS 変更は class または cssText でまとめる
- `js-index-maps` - 繰り返し参照は Map を組む
- `js-cache-property-access` - ループ内のオブジェクトプロパティはキャッシュする
- `js-cache-function-results` - 関数結果はモジュール先頭の Map にキャッシュする
- `js-cache-storage` - localStorage / sessionStorage の読み取りをキャッシュする
- `js-combine-iterations` - 複数の filter / map を1ループにまとめる
- `js-length-check-first` - 高い比較の前に配列長を見る
- `js-early-exit` - 関数は早く return する
- `js-hoist-regexp` - RegExp 生成はループの外へ
- `js-min-max-loop` - 最小／最大は sort ではなくループ
- `js-set-map-lookups` - O(1) 参照は Set / Map
- `js-tosorted-immutable` - イミュータブルな並び替えは toSorted()
- `js-flatmap-filter` - map と filter を1回の flatMap にまとめる
- `js-request-idle-callback` - 急がない処理はブラウザのアイドルへ

### 8. 応用パターン (LOW)

- `advanced-effect-event-deps` - `useEffectEvent` の結果を effect の依存に入れない
- `advanced-event-handler-refs` - イベントハンドラは ref に置く
- `advanced-init-once` - アプリの初期化はロードあたり1回
- `advanced-use-latest` - 安定したコールバック ref には useLatest

## 使い方

詳細とコード例は個別ルールファイルを読む。

```
rules/async-parallel.md
rules/bundle-barrel-imports.md
```

各ルールファイルの構成：
- なぜ重要かの短い説明
- 誤ったコード例と説明
- 正しいコード例と説明
- 追加の文脈と参照

## 全文

全ルールを展開した文書は `AGENTS.md`。

本プロジェクトのコンポーネント規約（`export const` 形式、`any` 禁止、型の明示）と食い違うときは、`original_rule.md` の React 章を優先する。
