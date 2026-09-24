# スキル再導入手順（イベント後の再現用）

当日の作業手順は `original_rule.md` を読む。本ファイルは使わない。

これは、ユーザー領域へ入れた Agent Skills を、当日後に同じ形で戻すための手順である。チームには共有しない。`.gitignore` の `original_rule/*.md` により、このディレクトリ直下の md は git に乗らない。サブフォルダに移すと git 管理対象になるので、直下の md のまま置く。

記録日: 2026-09-14  
実配置: `~/.agents/skills/`（Windows は `%USERPROFILE%\.agents\skills\`）  
CLI: `npx skills@latest` 1.5.x、`-g --agent cursor --copy`  
Cursor は `~/.agents/skills/` をユーザーレベルで読む。リポジトリの `.agents/skills/` や `.cursor/skills/` には置かない。

## 入れるスキル

| スキル名（フォルダ名 = `/` の呼び出し名） | 提供元 | 日本語本文の控え |
| --- | --- | --- |
| `frontend-design` | anthropics/skills | `skill_frontend-design.md` |
| `web-design-guidelines` | vercel-labs/agent-skills | `skill_web-design-guidelines.md` |
| `vercel-react-best-practices` | vercel-labs/agent-skills | `skill_vercel-react-best-practices.md` |
| `vercel-composition-patterns` | vercel-labs/agent-skills | `skill_vercel-composition-patterns.md` |
| `grill-me` | mattpocock/skills | `skill_grill-me.md` |
| `grilling` | mattpocock/skills | `skill_grilling.md` |
| `systematic-debugging` | obra/superpowers | `skill_systematic-debugging.md` |

`grill-me` は `grilling` を呼ぶので、両方入れる。  
`vercel-react-best-practices` と `vercel-composition-patterns` の `rules/` と `AGENTS.md` はベンダー英語のまま。日本語化したのは各 `SKILL.md` だけ。

## 1. 公式パッケージをユーザー領域へ入れる

リポジトリ直下で実行する。`-g` がある限りファイルはホームへ行く。`--agent '*'` は使わない（リポジトリ配下に漏れる）。

先に名前が残っているか確認する。

```
npx --yes skills@latest add anthropics/skills --list
npx --yes skills@latest add vercel-labs/agent-skills --list
npx --yes skills@latest add mattpocock/skills --list
npx --yes skills@latest add obra/superpowers --list
```

インストールする。

```
npx --yes skills@latest add anthropics/skills -g --agent cursor --skill frontend-design --copy -y
npx --yes skills@latest add vercel-labs/agent-skills -g --agent cursor --skill web-design-guidelines vercel-react-best-practices vercel-composition-patterns --copy -y
npx --yes skills@latest add mattpocock/skills -g --agent cursor --skill grill-me grilling --copy -y
npx --yes skills@latest add obra/superpowers -g --agent cursor --skill systematic-debugging --copy -y
```

このマシンでは Node v20.19.0 でも導入できた。CLI は Node 22 以上を要求する警告を出すことがある。

## 2. 日本語の SKILL.md を上書きする

`npx` 直後の `SKILL.md` は英語に戻る。控えをホームのスキルへコピーする。

macOS / zsh:

```
cp original_rule/skill_frontend-design.md ~/.agents/skills/frontend-design/SKILL.md
cp original_rule/skill_web-design-guidelines.md ~/.agents/skills/web-design-guidelines/SKILL.md
cp original_rule/skill_vercel-react-best-practices.md ~/.agents/skills/vercel-react-best-practices/SKILL.md
cp original_rule/skill_vercel-composition-patterns.md ~/.agents/skills/vercel-composition-patterns/SKILL.md
cp original_rule/skill_grill-me.md ~/.agents/skills/grill-me/SKILL.md
cp original_rule/skill_grilling.md ~/.agents/skills/grilling/SKILL.md
cp original_rule/skill_systematic-debugging.md ~/.agents/skills/systematic-debugging/SKILL.md
```

Windows PowerShell:

```
Copy-Item original_rule\skill_frontend-design.md $env:USERPROFILE\.agents\skills\frontend-design\SKILL.md
Copy-Item original_rule\skill_web-design-guidelines.md $env:USERPROFILE\.agents\skills\web-design-guidelines\SKILL.md
Copy-Item original_rule\skill_vercel-react-best-practices.md $env:USERPROFILE\.agents\skills\vercel-react-best-practices\SKILL.md
Copy-Item original_rule\skill_vercel-composition-patterns.md $env:USERPROFILE\.agents\skills\vercel-composition-patterns\SKILL.md
Copy-Item original_rule\skill_grill-me.md $env:USERPROFILE\.agents\skills\grill-me\SKILL.md
Copy-Item original_rule\skill_grilling.md $env:USERPROFILE\.agents\skills\grilling\SKILL.md
Copy-Item original_rule\skill_systematic-debugging.md $env:USERPROFILE\.agents\skills\systematic-debugging\SKILL.md
```

YAML の `name:` はフォルダ名と同じ英小文字のままにする。変えると Cursor が認識しない。

## 3. 確認する

次が揃っていること。

- `~/.agents/skills/` に上表の 7 フォルダがあり、各フォルダに `SKILL.md` がある
- リポジトリに `.agents/skills` も `.cursor/skills` も無い
- `git status` にスキル関連の追加が無い
- このリポジトリを開いた Cursor で `/` を打ち、上表のスキル名が出る（出なければ Cursor を開き直す）

macOS / zsh:

```
ls ~/.agents/skills
ls .agents/skills
ls .cursor/skills
```

（後者 2 つは `No such file or directory` なら成功）

Windows PowerShell:

```
Get-ChildItem $env:USERPROFILE\.agents\skills
Test-Path .agents\skills
Test-Path .cursor\skills
```

（`Test-Path` は `False` なら成功）

## 4. 外す（任意）

```
rm -rf ~/.agents/skills/frontend-design ~/.agents/skills/web-design-guidelines ~/.agents/skills/vercel-react-best-practices ~/.agents/skills/vercel-composition-patterns ~/.agents/skills/grill-me ~/.agents/skills/grilling ~/.agents/skills/systematic-debugging
```

Windows PowerShell:

```
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\frontend-design
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\web-design-guidelines
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\vercel-react-best-practices
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\vercel-composition-patterns
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\grill-me
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\grilling
Remove-Item -Recurse -Force $env:USERPROFILE\.agents\skills\systematic-debugging
```

ユーザー領域のスキルは、このマシンの他 Cursor プロジェクトでも候補に出る。
