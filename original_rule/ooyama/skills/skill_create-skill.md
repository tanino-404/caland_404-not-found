---
name: create-skill
description: >-
  Cursor の Agent Skill を作成する。新しいスキルを作成するときや、SKILL.md の
  構造について質問されたときに使用する。
---
# Cursor でスキルを作成する

このスキルは、Cursor 向けの効果的な Agent Skill を作成する手順をガイドします。スキルとは、エージェントに特定のタスクの実行方法を教える markdown ファイルです: チーム標準に沿った PR レビュー、好みのフォーマットでのコミットメッセージ生成、データベーススキーマの照会、その他あらゆる専門的なワークフローなど。

## 始める前に: 要件を収集する

スキルを作成する前に、以下についてユーザーから重要な情報を収集します:

1. **目的とスコープ**: このスキルはどんな特定のタスクやワークフローを支援すべきか？
2. **保存場所**: 個人用スキル（~/.cursor/skills/）にすべきか、プロジェクト用スキル（.cursor/skills/）にすべきか？
3. **トリガーシナリオ**: エージェントはいつ自動的にこのスキルを適用すべきか？
4. **重要なドメイン知識**: エージェントがまだ知らない、必要となる専門的な情報は何か？
5. **出力フォーマットの好み**: 求められる特定のテンプレート、フォーマット、スタイルはあるか？
6. **既存のパターン**: 従うべき既存の例や規約はあるか？

### ユーザーからの一字一句そのままのテキスト

ユーザーがスキルに使う正確な文言を提示した場合は、それを尊重し、`SKILL.md` に**一字一句そのまま**（同じ言葉、同じ順序で）使うこと。ユーザーの文章を言い換えたり、和らげたり、膨らませたりせず、頼まれていない見出しや解説をその周りに追加しないこと。

### コンテキストからの推測

過去の会話コンテキストがある場合は、そこで議論された内容からスキルを推測します。会話の中で浮かび上がったワークフロー、パターン、ドメイン知識に基づいてスキルを作成できます。

### 追加情報の収集

確認が必要な場合は、利用可能であれば AskQuestion ツールを使います:

```
Example AskQuestion usage:
- "Where should this skill be stored?" with options like ["Personal (~/.cursor/skills/)", "Project (.cursor/skills/)"]
- "Should this skill include executable scripts?" with options like ["Yes", "No"]
```

AskQuestion ツールが利用できない場合は、これらの質問を会話の中で行います。

---

## スキルファイルの構造

### ディレクトリレイアウト

スキルは `SKILL.md` ファイルを含むディレクトリとして保存されます:

```
skill-name/
├── SKILL.md              # Required - main instructions
├── reference.md          # Optional - detailed documentation
├── examples.md           # Optional - usage examples
└── scripts/              # Optional - utility scripts
    ├── validate.py
    └── helper.sh
```

### 保存場所

| 種類 | パス | スコープ |
|------|------|-------|
| 個人用 | ~/.cursor/skills/skill-name/ | 自分のすべてのプロジェクトで利用可能 |
| プロジェクト用 | .cursor/skills/skill-name/ | リポジトリを使う全員と共有 |

**重要**: `~/.cursor/skills-cursor/` にスキルを作成しないこと。このディレクトリは Cursor の内部組み込みスキル用に予約されており、システムによって自動的に管理されています。

### SKILL.md の構造

すべてのスキルには、YAML frontmatter と markdown 本文を持つ `SKILL.md` ファイルが必要です:

```markdown
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
disable-model-invocation: true
---

# Your Skill Name

## Instructions
Clear, step-by-step guidance for the agent.

## Examples
Concrete examples of using this skill.
```

デフォルトでは `disable-model-invocation: true` を設定し、スキルが明示的に名指しされたときだけ読み込まれるようにします。エージェントが周囲のコンテキストから自動的に呼び出すべき場合にのみ省略します。

### 必須メタデータフィールド

| フィールド | 要件 | 目的 |
|-------|--------------|---------|
| `name` | 最大 64 文字、小文字の英字/数字/ハイフンのみ | スキルの一意な識別子 |
| `description` | 最大 1024 文字、空でないこと | エージェントがスキルをいつ適用するか判断する助けになる |

---

## 効果的な description の書き方

description はスキルの発見にとって**極めて重要**です。エージェントはこれを使って、あなたのスキルをいつ適用するかを判断します。

### description のベストプラクティス

1. **三人称で書く**（description はシステムプロンプトに注入されます）:
   - ✅ 良い例: 「Excel ファイルを処理してレポートを生成する」
   - ❌ 避ける: 「私が Excel ファイルの処理をお手伝いできます」
   - ❌ 避ける: 「これを使って Excel ファイルを処理できます」

2. **具体的に書き、トリガーとなる用語を含める**:
   - ✅ 良い例: 「PDF ファイルからテキストと表を抽出し、フォームに記入し、文書を結合する。PDF ファイルを扱うとき、またはユーザーが PDF、フォーム、文書抽出に言及したときに使用する。」
   - ❌ 曖昧: 「文書を手伝う」

3. **WHAT と WHEN の両方を含める**:
   - WHAT: スキルが何をするか（具体的な能力）
   - WHEN: エージェントがいつ使うべきか（トリガーシナリオ）

### description の例

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.

# Code Review
description: Review code for quality, security, and best practices following team standards. Use when reviewing pull requests, code changes, or when the user asks for a code review.
```

---

## スキル作成の中核原則

### 1. 簡潔さが鍵

コンテキストウィンドウは、会話履歴、他のスキル、リクエストと共有されています。すべてのトークンがスペースを奪い合っています。

**デフォルトの前提**: エージェントはすでに非常に賢い。エージェントがまだ持っていないコンテキストだけを追加すること。

情報の一つひとつを吟味する:
- 「エージェントは本当にこの説明を必要としているか？」
- 「エージェントはこれを知っていると想定できないか？」
- 「この段落はトークンコストに見合っているか？」

**良い例（簡潔）**:
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

\`\`\`python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
\`\`\`
```

**悪い例（冗長）**:
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well...
```

### 2. SKILL.md は 500 行未満に保つ

最適なパフォーマンスのため、メインの SKILL.md ファイルは簡潔であるべきです。詳細なコンテンツには段階的開示（progressive disclosure）を使います。

### 3. 段階的開示

必須の情報は SKILL.md に置き、詳細なリファレンス資料は、エージェントが必要なときだけ読む別ファイルに置きます。

```markdown
# PDF Processing

## Quick start
[Essential instructions here]

## Additional resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

**参照は 1 階層までに保つ** - SKILL.md から参照ファイルへ直接リンクします。深くネストされた参照は、部分的にしか読まれない可能性があります。

### 4. 適切な自由度を設定する

タスクの壊れやすさに応じて具体性を合わせます:

| 自由度 | 使いどころ | 例 |
|---------------|-------------|---------|
| **高**（テキストによる指示） | 有効なアプローチが複数あり、コンテキスト依存 | コードレビューのガイドライン |
| **中**（擬似コード/テンプレート） | 推奨パターンがあり、ある程度の変化は許容 | レポート生成 |
| **低**（具体的なスクリプト） | 壊れやすい操作で、一貫性が最重要 | データベースマイグレーション |

---

## よく使うパターン

### テンプレートパターン

出力フォーマットのテンプレートを提供します:

```markdown
## Report structure

Use this template:

\`\`\`markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
\`\`\`
```

### 例示パターン

出力の品質が例を見ることに依存するスキル向け:

```markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
\`\`\`
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
\`\`\`

**Example 2:**
Input: Fixed bug where dates displayed incorrectly
Output:
\`\`\`
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
\`\`\`
```

### ワークフローパターン

複雑な操作を、チェックリスト付きの明確なステップに分割します:

```markdown
## Form filling workflow

Copy this checklist and track progress:

\`\`\`
Task Progress:
- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
\`\`\`

**Step 1: Analyze the form**
Run: \`python scripts/analyze_form.py input.pdf\`
...
```

### 条件分岐ワークフローパターン

判断ポイントを通じて導きます:

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   ...
```

### フィードバックループパターン

品質が重要なタスクでは、検証ループを実装します:

```markdown
## Document editing process

1. Make your edits
2. **Validate immediately**: \`python scripts/validate.py output/\`
3. If validation fails:
   - Review the error message
   - Fix the issues
   - Run validation again
4. **Only proceed when validation passes**
```

---

## ユーティリティスクリプト

事前に用意されたスクリプトは、生成されるコードより有利です:
- 生成されたコードより信頼性が高い
- トークンを節約できる（コンテキストにコードが載らない）
- 時間を節約できる（コード生成が不要）
- 使用のたびに一貫性を保証できる

```markdown
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF
\`\`\`bash
python scripts/analyze_form.py input.pdf > fields.json
\`\`\`

**validate.py**: Check for errors
\`\`\`bash
python scripts/validate.py fields.json
# Returns: "OK" or lists conflicts
\`\`\`
```

エージェントがスクリプトを**実行**すべきか（最も一般的）、リファレンスとして**読む**べきかを明確にすること。

---

## 避けるべきアンチパターン

### 1. Windows 形式のパス
- ✅ 使う: `scripts/helper.py`
- ❌ 避ける: `scripts\helper.py`

### 2. 選択肢が多すぎる
```markdown
# Bad - confusing
"You can use pypdf, or pdfplumber, or PyMuPDF, or..."

# Good - provide a default with escape hatch
"Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
```

### 3. 時間に依存する情報
```markdown
# Bad - will become outdated
"If you're doing this before August 2025, use the old API."

# Good - use an "old patterns" section
## Current method
Use the v2 API endpoint.

## Old patterns (deprecated)
<details>
<summary>Legacy v1 API</summary>
...
</details>
```

### 4. 用語の不統一
1 つの用語を選び、全体を通してそれを使うこと:
- ✅ 常に「API エンドポイント」（「URL」「ルート」「パス」を混在させない）
- ✅ 常に「フィールド」（「ボックス」「要素」「コントロール」を混在させない）

### 5. 曖昧なスキル名
- ✅ 良い例: `processing-pdfs`、`analyzing-spreadsheets`
- ❌ 避ける: `helper`、`utils`、`tools`

---

## スキル作成のワークフロー

ユーザーのスキル作成を手伝うときは、このプロセスに従います:

### フェーズ 1: 調査

以下について情報を収集します:
1. スキルの目的と主なユースケース
2. 保存場所（個人用かプロジェクト用か）
3. トリガーシナリオ
4. 特定の要件や制約
5. 従うべき既存の例やパターン

AskQuestion ツールにアクセスできる場合は、効率的な構造化収集に使います。なければ、会話の中で尋ねます。

### フェーズ 2: 設計

1. スキル名の草案を作る（小文字、ハイフン、最大 64 文字）
2. 具体的で三人称の description を書く
3. 必要なメインセクションの概要を作る
4. 補助ファイルやスクリプトが必要かを特定する

### フェーズ 3: 実装

1. ディレクトリ構造を作成する
2. frontmatter 付きの SKILL.md ファイルを書く
3. 補助的なリファレンスファイルを作成する
4. 必要ならユーティリティスクリプトを作成する

### フェーズ 4: 検証

1. SKILL.md が 500 行未満であることを確認する
2. description が具体的でトリガーとなる用語を含むことをチェックする
3. 全体を通して用語が一貫していることを確認する
4. すべてのファイル参照が 1 階層以内であることを確認する
5. スキルが発見され、適用されうることをテストする

---

## 完全な例

よく構造化されたスキルの完全な例です:

**ディレクトリ構造:**
```
code-review/
├── SKILL.md
├── STANDARDS.md
└── examples.md
```

**SKILL.md:**
```markdown
---
name: code-review
description: Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.
---

# Code Review

## Quick Start

When reviewing code:

1. Check for correctness and potential bugs
2. Verify security best practices
3. Assess code readability and maintainability
4. Ensure tests are adequate

## Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Code follows project style conventions
- [ ] Functions are appropriately sized and focused
- [ ] Error handling is comprehensive
- [ ] Tests cover the changes

## Providing Feedback

Format feedback as:
- 🔴 **Critical**: Must fix before merge
- 🟡 **Suggestion**: Consider improving
- 🟢 **Nice to have**: Optional enhancement

## Additional Resources

- For detailed coding standards, see [STANDARDS.md](STANDARDS.md)
- For example reviews, see [examples.md](examples.md)
```

---

## 最終チェックリスト

スキルを確定する前に、以下を確認します:

### 中核的な品質
- [ ] description が具体的で、キーとなる用語を含んでいる
- [ ] description が WHAT と WHEN の両方を含んでいる
- [ ] 三人称で書かれている
- [ ] SKILL.md の本文が 500 行未満である
- [ ] 全体を通して用語が一貫している
- [ ] 例が抽象的でなく具体的である

### 構造
- [ ] ファイル参照が 1 階層以内である
- [ ] 段階的開示が適切に使われている
- [ ] ワークフローに明確なステップがある
- [ ] 時間に依存する情報がない

### スクリプトを含める場合
- [ ] スクリプトが問題を先送りせず解決している
- [ ] 必要なパッケージが文書化されている
- [ ] エラー処理が明示的で役に立つ
- [ ] Windows 形式のパスがない
