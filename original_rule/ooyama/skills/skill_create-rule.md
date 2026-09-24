---
name: create-rule
description: >-
  AI への永続的なガイダンスとなる Cursor ルールを作成します。ルールを作りたい、
  コーディング規約を追加したい、プロジェクトの慣習を整備したい、ファイル固有の
  パターンを設定したい、RULE.md ファイルを作りたいとき、あるいは .cursor/rules/ や
  AGENTS.md について尋ねられたときに使います。
---
# Cursor ルールの作成

AI エージェントに永続的なコンテキストを提供するため、プロジェクトルールを `.cursor/rules/` に作成します。

## 要件の収集

ルールを作成する前に、以下を確定させます:

1. **目的**: このルールは何を強制または教えるべきか？
2. **スコープ**: 常に適用すべきか、特定のファイルに対してのみか？
3. **ファイルパターン**: ファイル固有の場合、どの glob パターンか？

### コンテキストからの推測

それまでの会話のコンテキストがある場合は、議論された内容からルールを推測してください。会話が複数の異なるトピックやパターンにわたる場合は、複数のルールを作成しても構いません。コンテキストがすでに答えを提供しているなら、冗長な質問をしないでください。

### 必須の質問

ユーザーがスコープを指定していない場合は、こう尋ねます:
- 「このルールは常に適用すべきですか、それとも特定のファイルを扱うときだけですか？」

特定のファイルに言及したものの具体的なパターンを提供していない場合は、こう尋ねます:
- 「このルールはどのファイルパターンに適用すべきですか？」（例: `**/*.ts`、`backend/**/*.py`）

ファイルパターンを明確にすることは非常に重要です。

これを効率的に収集するため、利用可能な場合は AskQuestion ツールを使ってください。

---

## ルールファイルのフォーマット

ルールは、YAML frontmatter を持つ `.cursor/rules/` 内の `.mdc` ファイルです:

```
.cursor/rules/
  typescript-standards.mdc
  react-patterns.mdc
  api-conventions.mdc
```

### ファイル構造

```markdown
---
description: Brief description of what this rule does
globs: **/*.ts  # File pattern for file-specific rules
alwaysApply: false  # Set to true if rule should always apply
---

# Rule Title

Your rule content here...
```

### Frontmatter のフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `description` | string | ルールの機能（ルールピッカーに表示される） |
| `globs` | string | ファイルパターン — マッチするファイルが開いているときにルールが適用される |
| `alwaysApply` | boolean | true の場合、すべてのセッションに適用される |

---

## ルールの設定パターン

### 常に適用（Always Apply）

すべての会話に適用すべき普遍的な規約の場合:

```yaml
---
description: Core coding standards for the project
alwaysApply: true
---
```

### 特定のファイルに適用

特定のファイルタイプを扱うときに適用されるルールの場合:

```yaml
---
description: TypeScript conventions for this project
globs: **/*.ts
alwaysApply: false
---
```

---

## ベストプラクティス

### ルールは簡潔に保つ

- **50 行未満**: ルールは簡潔で要点を押さえたものにする
- **1 ルール 1 関心事**: 大きなルールは焦点の絞られた単位に分割する
- **実行可能な内容**: 明快な社内ドキュメントのように書く
- **具体例**: 問題の修正方法について、できる限り具体例を提供する

---

## ルールの例

### TypeScript 規約

```markdown
---
description: TypeScript coding standards
globs: **/*.ts
alwaysApply: false
---

# Error Handling

\`\`\`typescript
// ❌ BAD
try {
  await fetchData();
} catch (e) {}

// ✅ GOOD
try {
  await fetchData();
} catch (e) {
  logger.error('Failed to fetch', { error: e });
  throw new DataFetchError('Unable to retrieve data', { cause: e });
}
\`\`\`
```

### React パターン

```markdown
---
description: React component patterns
globs: **/*.tsx
alwaysApply: false
---

# React Patterns

- Use functional components
- Extract custom hooks for reusable logic
- Colocate styles with components
```

---

## チェックリスト

- [ ] ファイルが `.cursor/rules/` 内の `.mdc` 形式である
- [ ] frontmatter が正しく設定されている
- [ ] コンテンツが 500 行未満である
- [ ] 具体例が含まれている
