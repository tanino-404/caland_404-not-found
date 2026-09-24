# 適用している Agent Skills 一覧（本文の控えは `skills/`）

記録日: 2026-09-24  
実配置: Cursor 組み込みは `~/.cursor/skills-cursor/`、個人導入分は `~/.agents/skills/`  
各スキルの本文（SKILL.md の全文）は `skills/skill_<スキル名>.md` に日本語の控えとして置いてある。`name:` は Cursor が認識する英小文字のまま。コード・パス・コマンドはそのまま。

## 一覧

| スキル名（`/` の呼び出し名） | 提供元 / 実配置 | 本文の控え |
| --- | --- | --- |
| `automate` | Cursor 組み込み | `skills/skill_automate.md` |
| `autopilot` | Cursor 組み込み | `skills/skill_autopilot.md` |
| `canvas` | Cursor 組み込み | `skills/skill_canvas.md` |
| `create-hook` | Cursor 組み込み | `skills/skill_create-hook.md` |
| `create-rule` | Cursor 組み込み | `skills/skill_create-rule.md` |
| `create-skill` | Cursor 組み込み | `skills/skill_create-skill.md` |
| `loop` | Cursor 組み込み | `skills/skill_loop.md` |
| `new-repo` | Cursor 組み込み | `skills/skill_new-repo.md` |
| `origin` | Cursor 組み込み | `skills/skill_origin.md` |
| `review-bugbot` | Cursor 組み込み | `skills/skill_review-bugbot.md` |
| `review-security` | Cursor 組み込み | `skills/skill_review-security.md` |
| `sdk` | Cursor 組み込み | `skills/skill_sdk.md` |
| `share` | Cursor 組み込み | `skills/skill_share.md` |
| `split-to-prs` | Cursor 組み込み | `skills/skill_split-to-prs.md` |
| `statusline` | Cursor 組み込み | `skills/skill_statusline.md` |
| `update-cursor-settings` | Cursor 組み込み | `skills/skill_update-cursor-settings.md` |
| `visualize` | Cursor 組み込み | `skills/skill_visualize.md` |
| `hallmark` | 個人導入（`~/.agents/skills/hallmark/`） | `skills/skill_hallmark.md` |

## 補足

- Cursor 組み込みスキルは Cursor 本体に同梱されているため、再インストール作業は不要。控えは中身の確認・記録用。
- `hallmark` だけがユーザー領域（`~/.agents/skills/`）に個人で導入したスキル。環境を作り直す場合は控えの `skills/skill_hallmark.md` を `~/.agents/skills/hallmark/SKILL.md` に置けば戻せる。
- スキルは常時実行されるわけではなく、リクエスト内容がスキルの用途に合致したときにエージェントが SKILL.md を読み込んで従う。
- 各スキルの用途は控えファイル冒頭の frontmatter（`name` / `description`）を参照。
