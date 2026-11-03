"""管理内容プラグインの雛形を作る。

使い方:
    cd server && source .venv/bin/activate && python new_plugin.py <id> <名前>

作るもの（plugins/<id>/ の 1 フォルダだけ。画面のコードは触らない）:
- plugin.json  記録 1 件 = 数値 1 つとメモ。期間の合計が目標以上で、空に星が舞う
- README.md    書き換える場所の案内

作ったあと plugin.json の fields・metrics・effects を目的に合わせて書き換え、
`python plugins.py validate <id>` で確かめる。書式は plugins/README.md。
"""

from __future__ import annotations

import json
import sys

import plugins

STAR = {
    "palette": {"y": "#ffd34a", "w": "#fff6c8"},
    "layers": [[".y.", "ywy", ".y."]],
    "glow": True,
}


def build_manifest(plugin_id: str, name: str) -> dict:
    return {
        "schemaVersion": plugins.SCHEMA_VERSION,
        "id": plugin_id,
        "name": name,
        "version": "0.1.0",
        "description": f"{name}を記録する。期間の合計が目標に届くと、空に星が舞う。",
        "fields": [
            {"key": "value", "type": "number", "label": "量", "min": 0, "required": True},
            {"key": "memo", "type": "text", "label": "メモ"},
        ],
        "metrics": [
            {"key": "total", "label": "合計", "agg": "sum", "field": "value"},
            {"key": "times", "label": "記録", "agg": "count", "unit": "回"},
        ],
        "goal": {"metric": "total", "op": ">="},
        "effects": [
            {"id": "plain", "minProgress": 0, "theme": "plain"},
            {
                "id": "stars",
                "minProgress": 1,
                "theme": "plain",
                "scene": {"sprites": [{"model": STAR, "count": 20, "zone": "sky", "motion": "bob", "size": 0.08}]},
            },
        ],
        "integrations": [],
    }


README = """# {name}（{plugin_id}）

`python new_plugin.py` で作った雛形。書式は `plugins/README.md`。

1. `plugin.json` の `fields` を、毎日つける項目に書き換える
2. `metrics` に数値化したい指標を書き、`goal.metric` で目標に使う指標を選ぶ
3. `effects` の `scene.sprites` に、目標達成で島に出すボクセルの絵を描く
4. サンプルを入れたいときは `sample.json` を置く（`plugins/fishing/sample.json` が例）
5. `cd server && source .venv/bin/activate && python plugins.py validate {plugin_id}`
"""


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("使い方: python new_plugin.py <id> <名前>", file=sys.stderr)
        return 2
    plugin_id, name = argv
    if plugins.ID_PATTERN.fullmatch(plugin_id) is None:
        raise ValueError(f"id は英小文字・数字・ハイフン（先頭は英小文字か数字、40 文字まで）です: {plugin_id}")
    folder = plugins.PLUGINS_DIR / plugin_id
    if folder.exists():
        raise FileExistsError(f"すでにあります: {folder}")
    folder.mkdir()
    (folder / "plugin.json").write_text(
        json.dumps(build_manifest(plugin_id, name), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (folder / "README.md").write_text(README.format(name=name, plugin_id=plugin_id), encoding="utf-8")
    manifest = plugins.load_manifest(plugin_id, plugins.PLUGINS_DIR)
    print(f"作成しました: plugins/{plugin_id}/（{manifest['name']}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
