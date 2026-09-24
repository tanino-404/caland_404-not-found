---
name: update-cursor-settings
description: >-
  settings.json 内の Cursor/VSCode ユーザー設定を変更する。エディタ設定、環境設定、
  構成、テーマ、フォントサイズ、タブサイズ、保存時フォーマット、自動保存、
  キーバインド、その他 settings.json の値を変更したいときに使う。
metadata:
  surfaces:
    - ide
---
# Cursor 設定の更新

このスキルは、Cursor/VSCode のユーザー設定を変更する手順を案内します。エディタ設定、環境設定、構成、テーマ、キーバインド、その他 `settings.json` の値を変更したいときに使ってください。

## 設定ファイルの場所

| OS | パス |
|----|------|
| macOS | ~/Library/Application Support/Cursor/User/settings.json |
| Linux | ~/.config/Cursor/User/settings.json |
| Windows | %APPDATA%\Cursor\User\settings.json |

## 設定を変更する前に

1. **既存の設定ファイルを読み**、現在の構成を把握する
2. **既存の設定を保持する** — ユーザーが依頼したものだけを追加・変更する
3. エディタを壊さないよう、書き込み前に **JSON 構文を検証する**

## 設定の変更

### ステップ 1: 現在の設定を読む

```typescript
// Read the settings file first
const settingsPath = "~/Library/Application Support/Cursor/User/settings.json";
// Use the Read tool to get current contents
```

### ステップ 2: 変更する設定を特定する

よくある設定カテゴリ:
- **エディタ**: `editor.fontSize`、`editor.tabSize`、`editor.wordWrap`、`editor.formatOnSave`
- **ワークベンチ**: `workbench.colorTheme`、`workbench.iconTheme`、`workbench.sideBar.location`
- **ファイル**: `files.autoSave`、`files.exclude`、`files.associations`
- **ターミナル**: `terminal.integrated.fontSize`、`terminal.integrated.shell.*`
- **Cursor 固有**: `cursor.` または `aipopup.` で始まる設定

### ステップ 3: 設定を更新する

settings.json を変更するとき:
1. 既存の JSON をパースする（コメントに対応 — VSCode の設定はコメント付き JSON をサポートする）
2. 依頼された設定を追加または更新する
3. 他の既存の設定はすべて保持する
4. 適切なフォーマット（2 スペースインデント）で書き戻す

### 例: フォントサイズの変更

ユーザーが「フォントを大きくして」と言った場合:

```json
{
  "editor.fontSize": 16
}
```

### 例: 保存時フォーマットの有効化

ユーザーが「保存時にコードをフォーマットして」と言った場合:

```json
{
  "editor.formatOnSave": true
}
```

### 例: テーマの変更

ユーザーが「ダークテーマにして」「テーマを変えて」と言った場合:

```json
{
  "workbench.colorTheme": "Default Dark Modern"
}
```

## 重要な注意事項

1. **コメント付き JSON**: VSCode/Cursor の settings.json はコメント（`//` と `/* */`）をサポートしている。読み取り時はコメントが存在しうることに注意する。書き込み時は可能ならコメントを保持する。

2. **再起動が必要な場合がある**: すぐに反映される設定もあれば、ウィンドウのリロードや Cursor の再起動が必要な設定もある。再起動が必要な場合はユーザーに伝える。

3. **バックアップ**: 大きな変更の場合は、設定ファイル内で Ctrl/Cmd+Z で元に戻せること、または git 管理下であれば git の変更を戻すことで元に戻せることに触れることを検討する。

4. **ワークスペース設定とユーザー設定**:
   - ユーザー設定（このスキルが扱う対象）: すべてのプロジェクトにグローバルに適用される
   - ワークスペース設定（`.vscode/settings.json`）: 現在のプロジェクトにのみ適用される

5. **コミットの帰属（Commit Attribution）**: ユーザーがコミットの帰属について尋ねた場合、編集したいのが **CLI エージェント** か **IDE エージェント** かを確認する。CLI エージェントの場合は `~/.cursor/cli-config.json` を変更する。IDE エージェントの場合は UI の **Cursor Settings > Agent > Attribution** から制御する（settings.json ではない）。

## よくあるユーザーの依頼 → 設定

| ユーザーの依頼 | 設定 |
|--------------|---------|
| 「フォントを大きく / 小さく」 | `editor.fontSize` |
| 「タブサイズを変えたい」 | `editor.tabSize` |
| 「保存時フォーマット」 | `editor.formatOnSave` |
| 「ワードラップ」 | `editor.wordWrap` |
| 「テーマを変えたい」 | `workbench.colorTheme` |
| 「ミニマップを隠したい」 | `editor.minimap.enabled` |
| 「自動保存」 | `files.autoSave` |
| 「行番号」 | `editor.lineNumbers` |
| 「括弧のマッチング」 | `editor.bracketPairColorization.enabled` |
| 「カーソルのスタイル」 | `editor.cursorStyle` |
| 「スムーズスクロール」 | `editor.smoothScrolling` |

## ワークフロー

1. ~/Library/Application Support/Cursor/User/settings.json を読む
2. JSON の内容をパースする
3. 依頼された設定を追加 / 変更する
4. 更新した JSON をファイルに書き戻す
5. 設定を変更したこと、およびリロードが必要かどうかをユーザーに伝える
