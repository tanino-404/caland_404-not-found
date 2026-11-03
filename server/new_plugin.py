"""管理プラグインの雛形を作る。

使い方:
    cd server && source .venv/bin/activate && python new_plugin.py <id> <タイトル>

作るもの:
- server/plugins/<id>/manifest.json（value の合計を月目標と比べる最小構成）
- src/src/plugins/effects/<Pascal>Effect.tsx（島の上にタイトルの看板を出す部品）
- src/src/plugins/effects/index.ts に 1 行追加

雛形を作ったら、manifest.json のフィールドと式、エフェクト部品を目的の管理に合わせて書き換える。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import plugin_store

SERVER_DIR = Path(__file__).resolve().parent
EFFECTS_DIR = SERVER_DIR.parent / "src" / "src" / "plugins" / "effects"
INDEX_PATH = EFFECTS_DIR / "index.ts"
IMPORT_ANCHOR = "import type { IslandTheme } from '../../types/ledger';"
REGISTRY_ANCHOR = "export const ISLAND_EFFECTS: Record<string, IslandEffect> = {"

EFFECT_TEMPLATE = """import {{ Html }} from '@react-three/drei';
import {{ Voxel }} from '../../components/models/Voxel';

/** {title} の達成エフェクト（雛形）。島の上に看板を出す。自由に作り替えてよい */
export const {component} = () => (
  <group position={{[0, 5.4, 0]}}>
    <Voxel x={{0}} y={{-1.2}} z={{0}} w={{0.12}} h={{1.2}} d={{0.12}} color="#7a5230" />
    <Voxel x={{0}} y={{0}} z={{0}} w={{2.6}} h={{1}} d={{0.14}} color="#f3e2b6" />
    <Voxel x={{0}} y={{0}} z={{-0.01}} w={{2.72}} h={{1.06}} d={{0.1}} color="#1b2a41" />
    <Html center position={{[0, 0.5, 0.12]}}>
      <div
        style={{{{
          fontFamily: "'DotGothic16', sans-serif",
          fontSize: '18px',
          color: '#1b2a41',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 0 #fff8e7',
        }}}}
      >
        {title} 達成!
      </div>
    </Html>
  </group>
);
"""


def pascal_case(plugin_id: str) -> str:
    return "".join(part.capitalize() for part in plugin_id.split("_") if part != "")


def build_manifest(plugin_id: str, title: str) -> dict:
    return {
        "id": plugin_id,
        "title": title,
        "fields": [
            {
                "id": "value",
                "label": "値",
                "type": "number",
                "role": "progress",
                "min": 0,
            },
            {
                "id": "note",
                "label": "メモ",
                "type": "text",
                "role": "memo",
                "placeholder": "今日の記録",
            },
        ],
        "progress": {
            "label": title,
            "formula": "sum:value",
            "compare": "gte",
            "goal": "per_period",
        },
        "effect": plugin_id,
        "achievedLabel": "達成",
    }


def write_manifest(plugin_id: str, title: str) -> Path:
    plugin_dir = plugin_store.PLUGINS_DIR / plugin_id
    if plugin_dir.exists():
        raise FileExistsError(f"{plugin_dir} は既にあります")
    manifest = build_manifest(plugin_id, title)
    plugin_store._validate_manifest(plugin_id, manifest)
    plugin_dir.mkdir(parents=True)
    path = plugin_dir / "manifest.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")
    return path


def write_effect(plugin_id: str, title: str) -> tuple[Path, str]:
    component = f"{pascal_case(plugin_id)}Effect"
    path = EFFECTS_DIR / f"{component}.tsx"
    if path.exists():
        raise FileExistsError(f"{path} は既にあります")
    path.write_text(EFFECT_TEMPLATE.format(title=title, component=component), "utf-8")
    return path, component


def register_effect(plugin_id: str, component: str) -> None:
    source = INDEX_PATH.read_text("utf-8")
    if f"  {plugin_id}: " in source:
        raise ValueError(f"index.ts に {plugin_id} の行が既にあります")
    if IMPORT_ANCHOR not in source or REGISTRY_ANCHOR not in source:
        raise ValueError(f"{INDEX_PATH} の目印行が見つかりません。手で追加してください")
    source = source.replace(
        IMPORT_ANCHOR,
        f"{IMPORT_ANCHOR}\nimport {{ {component} }} from './{component}';",
        1,
    )
    source = source.replace(
        REGISTRY_ANCHOR,
        f"{REGISTRY_ANCHOR}\n  {plugin_id}: {{ theme: 'plain', Scene: {component} }},",
        1,
    )
    INDEX_PATH.write_text(source, "utf-8")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("使い方: python new_plugin.py <id> <タイトル>")
    plugin_id, title = sys.argv[1], sys.argv[2]
    if not plugin_store.ID_PATTERN.match(plugin_id):
        raise SystemExit(f"id は英小文字・数字・アンダースコアだけです: {plugin_id!r}")
    if title.strip() == "":
        raise SystemExit("タイトルが空です")
    manifest_path = write_manifest(plugin_id, title.strip())
    effect_path, component = write_effect(plugin_id, title.strip())
    register_effect(plugin_id, component)
    print(f"作成: {manifest_path}")
    print(f"作成: {effect_path}")
    print(f"追記: {INDEX_PATH}（{plugin_id} → {component}）")
    print("manifest.json のフィールドと式、エフェクト部品を目的に合わせて書き換えてください。")


if __name__ == "__main__":
    main()
