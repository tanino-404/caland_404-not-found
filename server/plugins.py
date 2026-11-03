"""管理内容プラグインの読み込み・検証・記録・目標・外部連携。

プラグインはリポジトリ直下の plugins/<id>/plugin.json。書式は plugins/README.md。
グループは id だけで参照する。グループの仕様が変わっても、記録と目標は group_id を持つだけ。

配布前の検証：python plugins.py validate [plugin_id ...]
"""

from __future__ import annotations

import calendar
import hmac
import json
import math
import os
import random
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, unquote

PLUGINS_DIR = Path(__file__).resolve().parents[1] / "plugins"
ENV_PATH = Path(__file__).resolve().parents[1] / "secret" / ".env"
SCHEMA_VERSION = 1
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
ENV_PATTERN = re.compile(r"^[A-Z_][A-Z0-9_]*$")
FIELD_TYPES = ("text", "number", "integer", "select", "tags", "boolean", "date", "place")
NUMERIC_TYPES = ("number", "integer")
AGGREGATES = ("sum", "count", "max", "min", "avg", "latest", "delta")
GOAL_OPS = (">=", "<=")
HOOK_EVENTS = ("entry.created", "goal.achieved")
COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
# 画面（src/src/lib/effects.ts の EFFECT_THEMES）が描ける島の土台
BUILTIN_THEMES = ("plain", "luxury", "muscle", "library")
# 画面（src/src/components/month/EffectSprites.tsx）が描ける置き場所と動き
SPRITE_ZONES = ("sea", "sky", "shore", "rooftop")
SPRITE_MOTIONS = ("orbit", "jump", "bob", "hop", "pump")
MAX_SPRITES = 8
MAX_SPRITE_COUNT = 40
MAX_SCENE_VOXELS = 4000

SCHEMA = """
CREATE TABLE IF NOT EXISTS plugin_groups (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plugin_group_members (
  group_id TEXT NOT NULL,
  member TEXT NOT NULL,
  PRIMARY KEY (group_id, member)
);
CREATE TABLE IF NOT EXISTS plugin_entries (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  date TEXT NOT NULL,
  data_json TEXT NOT NULL,
  owners_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS plugin_entries_scope ON plugin_entries (plugin_id, group_id, date);
CREATE TABLE IF NOT EXISTS plugin_goals (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  label TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  target NUMERIC NOT NULL,
  CHECK (start_date <= end_date)
);
"""


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def immediate(conn: sqlite3.Connection):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
    except Exception:
        conn.rollback()
        raise
    else:
        conn.commit()


def new_id(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{random.randrange(1_000_000)}"


def today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def parse_date(value: object, key: str) -> str:
    if not isinstance(value, str):
        raise ApiError(400, f"{key} は YYYY-MM-DD である必要があります")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ApiError(400, f"{key}: {exc}") from exc
    if parsed.strftime("%Y-%m-%d") != value:
        raise ApiError(400, f"{key} は YYYY-MM-DD である必要があります")
    return value


# ---------- 外部連携の形式（アダプター） ----------


def _template_values(event: dict) -> dict:
    status = event["status"]
    goal = status["goal"]
    values = {
        "event": event["event"],
        "plugin": event["plugin"],
        "pluginName": event["pluginName"],
        "group": event["group"],
        "date": event["entry"]["date"],
        "value": status["value"],
        "target": None if goal is None else goal["target"],
        "progress": round(status["progress"] * 100),
    }
    values.update(event["entry"]["data"])
    return values


def _adapter_json(hook: dict, event: dict) -> dict:
    return event


def _adapter_discord(hook: dict, event: dict) -> dict:
    return {"content": hook["template"].format_map(_template_values(event))}


ADAPTERS: dict[str, Callable[[dict, dict], dict]] = {
    "json": _adapter_json,
    "discord": _adapter_discord,
}


# ---------- plugin.json の検証 ----------


def _expect(ok: bool, where: str, message: str) -> None:
    if not ok:
        raise ValueError(f"{where}: {message}")


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _option_values(field: dict) -> list[str]:
    return [option["value"] for option in field["options"]]


def _validate_fields(fields: object, where: str) -> dict[str, dict]:
    _expect(isinstance(fields, list) and len(fields) > 0, where, "fields は 1 つ以上の配列です")
    found: dict[str, dict] = {}
    for field in fields:
        _expect(isinstance(field, dict), where, "fields の要素はオブジェクトです")
        key = field.get("key")
        _expect(isinstance(key, str) and KEY_PATTERN.fullmatch(key) is not None, where, f"field key が不正です: {key!r}")
        _expect(key not in found, where, f"field key が重複しています: {key}")
        _expect(field.get("type") in FIELD_TYPES, where, f"{key}.type は {', '.join(FIELD_TYPES)} のどれかです")
        _expect(isinstance(field.get("label"), str), where, f"{key}.label は文字列です")
        _expect(isinstance(field.get("required", False), bool), where, f"{key}.required は真偽値です")
        if field["type"] == "select":
            options = field.get("options")
            _expect(isinstance(options, list) and len(options) > 0, where, f"{key}.options は 1 つ以上の配列です")
            values: list[str] = []
            for option in options:
                _expect(
                    isinstance(option, dict)
                    and isinstance(option.get("value"), str)
                    and option["value"] != ""
                    and isinstance(option.get("label"), str)
                    and option["label"] != "",
                    where,
                    f"{key}.options の要素は {{ value, label }} の空でない文字列ペアです",
                )
                _expect(option["value"] not in values, where, f"{key}.options の value が重複しています: {option['value']}")
                values.append(option["value"])
        for bound in ("min", "max"):
            if bound in field:
                _expect(
                    field["type"] in NUMERIC_TYPES and _is_number(field[bound]),
                    where,
                    f"{key}.{bound} は数値の項目にだけ数値で書けます",
                )
        found[key] = field
    return found


def _validate_metrics(metrics: object, fields: dict[str, dict], where: str) -> set[str]:
    _expect(isinstance(metrics, list) and len(metrics) > 0, where, "metrics は 1 つ以上の配列です")
    keys: set[str] = set()
    for metric in metrics:
        _expect(isinstance(metric, dict), where, "metrics の要素はオブジェクトです")
        key = metric.get("key")
        _expect(isinstance(key, str) and KEY_PATTERN.fullmatch(key) is not None, where, f"metric key が不正です: {key!r}")
        _expect(key not in keys, where, f"metric key が重複しています: {key}")
        _expect(isinstance(metric.get("label"), str), where, f"{key}.label は文字列です")
        _expect(metric.get("agg") in AGGREGATES, where, f"{key}.agg は {', '.join(AGGREGATES)} のどれかです")
        if "op" in metric:
            _expect(metric["op"] in GOAL_OPS, where, f"{key}.op は >= か <= です")
        if metric["agg"] != "count":
            target = fields.get(metric.get("field", ""))
            _expect(
                target is not None and target["type"] in NUMERIC_TYPES,
                where,
                f"{key}.field は数値の項目です",
            )
        for rule_key in ("negateWhen", "where"):
            if rule_key not in metric:
                continue
            rule = metric[rule_key]
            _expect(isinstance(rule, dict), where, f"{key}.{rule_key} はオブジェクトです")
            selector = fields.get(rule.get("field", ""))
            _expect(
                selector is not None and selector["type"] == "select",
                where,
                f"{key}.{rule_key}.field は select の項目です",
            )
            _expect(
                isinstance(rule.get("values"), list) and all(v in _option_values(selector) for v in rule["values"]),
                where,
                f"{key}.{rule_key}.values は options の value です",
            )
        keys.add(key)
    return keys


def _validate_integrations(integrations: object, fields: dict[str, dict], where: str) -> None:
    _expect(isinstance(integrations, list), where, "integrations は配列です")
    seen: set[str] = set()
    for hook in integrations:
        _expect(isinstance(hook, dict), where, "integrations の要素はオブジェクトです")
        hook_id = hook.get("id")
        _expect(isinstance(hook_id, str) and ID_PATTERN.fullmatch(hook_id) is not None, where, f"integration id が不正です: {hook_id!r}")
        _expect(hook_id not in seen, where, f"integration id が重複しています: {hook_id}")
        seen.add(hook_id)
        direction = hook.get("direction")
        if direction == "outgoing":
            _expect(hook.get("on") in HOOK_EVENTS, where, f"{hook_id}.on は {', '.join(HOOK_EVENTS)} のどれかです")
            _expect(hook.get("adapter") in ADAPTERS, where, f"{hook_id}.adapter は {', '.join(ADAPTERS)} のどれかです")
            _expect(isinstance(hook.get("urlEnv"), str) and ENV_PATTERN.fullmatch(hook["urlEnv"]) is not None, where, f"{hook_id}.urlEnv は環境変数名です")
            if hook["adapter"] == "discord":
                _expect(isinstance(hook.get("template"), str), where, f"{hook_id}.template は文字列です")
        elif direction == "incoming":
            mapping = hook.get("map")
            _expect(isinstance(mapping, dict) and len(mapping) > 0, where, f"{hook_id}.map は 1 つ以上の対応です")
            for field, source in mapping.items():
                _expect(field in fields, where, f"{hook_id}.map の {field} は fields にありません")
                _expect(isinstance(source, str) and source != "", where, f"{hook_id}.map.{field} は取り出す位置（a.b.c）です")
            if "dateFrom" in hook:
                _expect(isinstance(hook["dateFrom"], str), where, f"{hook_id}.dateFrom は文字列です")
            if "tokenEnv" in hook:
                _expect(isinstance(hook["tokenEnv"], str) and ENV_PATTERN.fullmatch(hook["tokenEnv"]) is not None, where, f"{hook_id}.tokenEnv は環境変数名です")
        else:
            raise ValueError(f"{where}: {hook_id}.direction は outgoing か incoming です")


def _is_color(value: object) -> bool:
    return isinstance(value, str) and COLOR_PATTERN.fullmatch(value) is not None


def _validate_model(model: object, where: str) -> int:
    """ボクセルの絵。layers は下から上、各層は奥から手前の行、各行の 1 文字が 1 ボクセル（'.' は空）。"""
    _expect(isinstance(model, dict), where, "model はオブジェクトです")
    assert isinstance(model, dict)
    palette = model.get("palette")
    _expect(isinstance(palette, dict) and len(palette) > 0, where, "model.palette は { 1 文字: 色 } です")
    assert isinstance(palette, dict)
    for char, color in palette.items():
        _expect(len(char) == 1 and char != ".", where, f"palette のキーは '.' 以外の 1 文字です: {char!r}")
        _expect(_is_color(color), where, f"palette.{char} は #rrggbb です: {color!r}")
    if "glow" in model:
        _expect(isinstance(model["glow"], bool), where, "model.glow は真偽値です")
    layers = model.get("layers")
    _expect(isinstance(layers, list) and len(layers) > 0, where, "model.layers は 1 つ以上の層です")
    assert isinstance(layers, list)
    voxels = 0
    for layer in layers:
        _expect(
            isinstance(layer, list) and len(layer) > 0 and all(isinstance(row, str) for row in layer),
            where,
            "model.layers の各層は文字列の配列です",
        )
        for row in layer:
            for char in row:
                _expect(char == "." or char in palette, where, f"palette に無い文字です: {char!r}")
                if char != ".":
                    voxels += 1
    _expect(voxels > 0, where, "model にボクセルがありません")
    return voxels


def _validate_scene(scene: object, where: str) -> None:
    _expect(isinstance(scene, dict), where, "scene はオブジェクトです")
    assert isinstance(scene, dict)
    for key in ("sky", "horizon", "ambient"):
        if key in scene:
            _expect(_is_color(scene[key]), where, f"scene.{key} は #rrggbb です")
    sprites = scene.get("sprites", [])
    _expect(isinstance(sprites, list) and len(sprites) <= MAX_SPRITES, where, f"scene.sprites は {MAX_SPRITES} 種類までの配列です")
    total = 0
    for index, sprite in enumerate(sprites):
        at = f"{where} scene.sprites[{index}]"
        _expect(isinstance(sprite, dict), at, "オブジェクトです")
        count = sprite.get("count")
        _expect(isinstance(count, int) and not isinstance(count, bool) and 1 <= count <= MAX_SPRITE_COUNT, at, f"count は 1〜{MAX_SPRITE_COUNT} の整数です")
        _expect(sprite.get("zone") in SPRITE_ZONES, at, f"zone は {', '.join(SPRITE_ZONES)} のどれかです")
        _expect(sprite.get("motion") in SPRITE_MOTIONS, at, f"motion は {', '.join(SPRITE_MOTIONS)} のどれかです")
        size = sprite.get("size")
        _expect(_is_number(size) and 0.01 <= size <= 0.5, at, "size（1 ボクセルの大きさ）は 0.01〜0.5 です")
        if "speed" in sprite:
            _expect(_is_number(sprite["speed"]) and 0 < sprite["speed"] <= 5, at, "speed は 0 より大きく 5 以下です")
        total += _validate_model(sprite.get("model"), at) * count
    _expect(total <= MAX_SCENE_VOXELS, where, f"scene のボクセル数（絵のボクセル × count の合計）は {MAX_SCENE_VOXELS} までです: {total}")


def _validate_effects(effects: object, where: str) -> None:
    _expect(isinstance(effects, list) and len(effects) > 0, where, "effects は 1 つ以上の配列です")
    assert isinstance(effects, list)
    seen: set[str] = set()
    for effect in effects:
        _expect(
            isinstance(effect, dict)
            and isinstance(effect.get("id"), str)
            and KEY_PATTERN.fullmatch(effect["id"]) is not None
            and _is_number(effect.get("minProgress"))
            and 0 <= effect["minProgress"] <= 1
            and effect.get("theme") in BUILTIN_THEMES,
            where,
            f"effects の要素は {{ id, minProgress: 0〜1, theme: {' か '.join(BUILTIN_THEMES)}, scene? }} です",
        )
        _expect(effect["id"] not in seen, where, f"effect id が重複しています: {effect['id']}")
        seen.add(effect["id"])
        if "scene" in effect:
            _validate_scene(effect["scene"], f"{where} effect {effect['id']}")
    _expect(any(e["minProgress"] == 0 for e in effects), where, "effects に minProgress 0 の既定が要ります")


def validate_manifest(manifest: object, dir_name: str) -> dict:
    where = f"plugins/{dir_name}/plugin.json"
    _expect(isinstance(manifest, dict), where, "オブジェクトである必要があります")
    assert isinstance(manifest, dict)
    _expect(manifest.get("schemaVersion") == SCHEMA_VERSION, where, f"schemaVersion は {SCHEMA_VERSION} です")
    _expect(manifest.get("id") == dir_name, where, "id はフォルダ名と同じにしてください")
    for key in ("name", "version"):
        _expect(isinstance(manifest.get(key), str) and manifest[key] != "", where, f"{key} は空でない文字列です")
    fields = _validate_fields(manifest.get("fields"), where)
    metric_keys = _validate_metrics(manifest.get("metrics"), fields, where)
    goal = manifest.get("goal")
    _expect(isinstance(goal, dict), where, "goal はオブジェクトです")
    _expect(goal.get("metric") in metric_keys, where, "goal.metric は metrics の key です")
    _expect(goal.get("op") in GOAL_OPS, where, "goal.op は >= か <= です")
    _validate_effects(manifest.get("effects"), where)
    _validate_integrations(manifest.get("integrations", []), fields, where)
    return manifest


def load_manifest(plugin_id: str, plugins_dir: Path) -> dict:
    if ID_PATTERN.fullmatch(plugin_id) is None:
        raise ApiError(404, f"プラグインが見つかりません: {plugin_id}")
    path = plugins_dir / plugin_id / "plugin.json"
    if not path.is_file():
        raise ApiError(404, f"プラグインが見つかりません: {plugin_id}")
    return validate_manifest(json.loads(path.read_text(encoding="utf-8")), plugin_id)


def list_manifests(plugins_dir: Path) -> list[dict]:
    return [
        load_manifest(child.name, plugins_dir)
        for child in sorted(plugins_dir.iterdir())
        if (child / "plugin.json").is_file()
    ]


def pick_effect(manifest: dict, progress: float) -> str:
    reached = [e for e in manifest["effects"] if progress >= e["minProgress"]]
    return max(reached, key=lambda e: e["minProgress"])["id"]


# ---------- サンプルデータ（plugins/<id>/sample.json） ----------


def _sample_error(where: str, exc: ApiError) -> ValueError:
    return ValueError(f"{where}: {exc}")


def load_sample(manifest: dict, plugins_dir: Path) -> dict | None:
    """sample.json を読んで検証する。無ければ None。"""
    path = plugins_dir / manifest["id"] / "sample.json"
    if not path.is_file():
        return None
    where = f"plugins/{manifest['id']}/sample.json"
    sample = json.loads(path.read_text(encoding="utf-8"))
    _expect(isinstance(sample, dict), where, "オブジェクトである必要があります")
    groups = sample.get("groups")
    _expect(isinstance(groups, list) and len(groups) > 0, where, "groups は 1 つ以上の配列です")
    members_of: dict[str, list[str]] = {}
    for group in groups:
        _expect(
            isinstance(group, dict)
            and isinstance(group.get("id"), str)
            and ID_PATTERN.fullmatch(group["id"]) is not None
            and isinstance(group.get("name"), str)
            and isinstance(group.get("members"), list)
            and len(group["members"]) > 0
            and all(isinstance(m, str) and m != "" for m in group["members"]),
            where,
            "groups の要素は { id, name, members: [名前] } です",
        )
        _expect(group["id"] not in members_of, where, f"group id が重複しています: {group['id']}")
        members_of[group["id"]] = group["members"]
    metric_keys = [m["key"] for m in manifest["metrics"]]
    for index, entry in enumerate(sample.get("entries", [])):
        at = f"{where} entries[{index}]"
        _expect(isinstance(entry, dict) and entry.get("group") in members_of, at, "group は groups の id です")
        try:
            parse_date(entry.get("date"), "date")
            entry["data"] = validate_data(manifest, entry.get("data"))
        except ApiError as exc:
            raise _sample_error(at, exc) from exc
        owners = entry.get("owners")
        _expect(
            isinstance(owners, list) and len(owners) > 0 and all(o in members_of[entry["group"]] for o in owners),
            at,
            "owners はそのグループのメンバーです",
        )
    for index, goal in enumerate(sample.get("goals", [])):
        at = f"{where} goals[{index}]"
        _expect(isinstance(goal, dict) and goal.get("group") in members_of, at, "group は groups の id です")
        try:
            start = parse_date(goal.get("start"), "start")
            end = parse_date(goal.get("end"), "end")
        except ApiError as exc:
            raise _sample_error(at, exc) from exc
        _expect(start <= end, at, "start は end 以前です")
        _expect(_is_number(goal.get("target")), at, "target は数値です")
        _expect(isinstance(goal.get("label", ""), str), at, "label は文字列です")
        _expect(goal.get("metric", manifest["goal"]["metric"]) in metric_keys, at, "metric は metrics の key です")
    return sample


def insert_sample(conn: sqlite3.Connection, manifest: dict, sample: dict) -> None:
    plugin_id = manifest["id"]
    for group in sample["groups"]:
        save_group(conn, group["id"], plugin_id, group["name"])
        for member in group["members"]:
            add_group_member(conn, group["id"], member)
    for index, entry in enumerate(sample.get("entries", [])):
        insert_entry(
            conn, plugin_id, entry["group"], f"{plugin_id}-sample-{index}", entry["date"], entry["data"], entry["owners"]
        )
    for index, goal in enumerate(sample.get("goals", [])):
        save_goal(
            conn,
            {
                "id": f"goal-{plugin_id}-sample-{index}",
                "pluginId": plugin_id,
                "groupId": goal["group"],
                "metric": goal.get("metric", manifest["goal"]["metric"]),
                "label": goal.get("label", ""),
                "start": goal["start"],
                "end": goal["end"],
                "target": goal["target"],
            },
        )


def plugin_has_groups(conn: sqlite3.Connection, plugin_id: str) -> bool:
    return conn.execute("SELECT 1 FROM plugin_groups WHERE plugin_id = ?", (plugin_id,)).fetchone() is not None


def delete_plugin_data(conn: sqlite3.Connection, plugin_id: str | None = None) -> None:
    """plugin_id のデータを消す。None なら全プラグイン。"""
    if plugin_id is None:
        for table in ("plugin_entries", "plugin_goals", "plugin_group_members", "plugin_groups"):
            conn.execute(f"DELETE FROM {table}")
        return
    conn.execute("DELETE FROM plugin_entries WHERE plugin_id = ?", (plugin_id,))
    conn.execute("DELETE FROM plugin_goals WHERE plugin_id = ?", (plugin_id,))
    conn.execute(
        "DELETE FROM plugin_group_members WHERE group_id IN (SELECT id FROM plugin_groups WHERE plugin_id = ?)",
        (plugin_id,),
    )
    conn.execute("DELETE FROM plugin_groups WHERE plugin_id = ?", (plugin_id,))


# ---------- 記録の値 ----------


def _range_message(key: str, field: dict) -> str:
    noun = "整数" if field["type"] == "integer" else "数値"
    low = field.get("min")
    high = field.get("max")
    if low is not None and high is not None:
        return f"{key} は {low} から {high} の{noun}である必要があります"
    if low is not None:
        return f"{key} は {low} 以上の{noun}である必要があります"
    if high is not None:
        return f"{key} は {high} 以下の{noun}である必要があります"
    return f"{key} は{noun}である必要があります"


def _check_value(key: str, field: dict, value: object) -> object:
    kind = field["type"]
    if kind in NUMERIC_TYPES:
        ok = _is_number(value) and math.isfinite(value) and (kind == "number" or isinstance(value, int))
        if ok and "min" in field and value < field["min"]:
            ok = False
        if ok and "max" in field and value > field["max"]:
            ok = False
        if not ok:
            raise ApiError(400, _range_message(key, field))
        return value
    if kind == "select":
        values = _option_values(field)
        if value not in values:
            raise ApiError(400, f"{key} は {' または '.join(values)} である必要があります")
        return value
    if kind in ("text", "place"):
        if not isinstance(value, str):
            raise ApiError(400, f"{key} は文字列である必要があります")
        return value.strip()
    if kind == "tags":
        if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() != "" for v in value):
            raise ApiError(400, f"{key} は空でない文字列の配列である必要があります")
        return list(dict.fromkeys(v.strip() for v in value))
    if kind == "boolean":
        if not isinstance(value, bool):
            raise ApiError(400, f"{key} は真偽値である必要があります")
        return value
    return parse_date(value, key)


def validate_data(manifest: dict, data: object) -> dict:
    if not isinstance(data, dict):
        raise ApiError(400, "data はオブジェクトである必要があります")
    fields = {f["key"]: f for f in manifest["fields"]}
    unknown = sorted(set(data) - set(fields))
    if unknown:
        raise ApiError(400, f"定義されていない項目です: {', '.join(unknown)}")
    clean: dict = {}
    for key, field in fields.items():
        required = field.get("required", False)
        if key not in data or data[key] is None:
            if required:
                raise ApiError(400, f"{key} がありません")
            continue
        value = _check_value(key, field, data[key])
        if value == "" or value == []:
            if required:
                raise ApiError(400, f"{key} が空です")
            continue
        clean[key] = value
    return clean


# ---------- グループ ----------


def _row_to_group(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "pluginId": row["plugin_id"],
        "name": row["name"],
        "members": group_members(conn, row["id"]),
    }


def group_members(conn: sqlite3.Connection, group_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT member FROM plugin_group_members WHERE group_id = ? ORDER BY rowid", (group_id,)
    ).fetchall()
    return [row["member"] for row in rows]


def fetch_groups(conn: sqlite3.Connection, plugin_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, plugin_id, name FROM plugin_groups WHERE plugin_id = ? ORDER BY rowid", (plugin_id,)
    ).fetchall()
    return [_row_to_group(conn, row) for row in rows]


def require_group(conn: sqlite3.Connection, plugin_id: str, group_id: str) -> None:
    row = conn.execute(
        "SELECT 1 FROM plugin_groups WHERE id = ? AND plugin_id = ?", (group_id, plugin_id)
    ).fetchone()
    if row is None:
        raise ApiError(404, f"グループが見つかりません: {group_id}")


def require_known_member(conn: sqlite3.Connection, name: str) -> None:
    if conn.execute("SELECT 1 FROM members WHERE name = ?", (name,)).fetchone() is None:
        raise ApiError(400, f'"{name}" はメンバーではありません')


def require_member_of(conn: sqlite3.Connection, group_id: str, user: str) -> None:
    if user not in group_members(conn, group_id):
        raise ApiError(403, f'"{user}" はこのグループのメンバーではありません')


def save_group(conn: sqlite3.Connection, group_id: str, plugin_id: str, name: str) -> None:
    conn.execute(
        "INSERT INTO plugin_groups (id, plugin_id, name) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING",
        (group_id, plugin_id, name),
    )


def add_group_member(conn: sqlite3.Connection, group_id: str, member: str) -> None:
    conn.execute(
        "INSERT INTO plugin_group_members (group_id, member) VALUES (?, ?) ON CONFLICT DO NOTHING",
        (group_id, member),
    )


# ---------- 記録 ----------


def _row_to_entry(row: sqlite3.Row) -> dict:
    owners = json.loads(row["owners_json"])
    data = json.loads(row["data_json"])
    if not isinstance(owners, list) or not isinstance(data, dict):
        raise ValueError(f"記録の保存形式が不正です: {row['id']}")
    return {
        "id": row["id"],
        "pluginId": row["plugin_id"],
        "groupId": row["group_id"],
        "date": row["date"],
        "data": data,
        "owners": owners,
    }


def fetch_entries(
    conn: sqlite3.Connection,
    plugin_id: str,
    group_id: str,
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    """記録した順で返す。期間は両端を含む。"""
    sql = "SELECT * FROM plugin_entries WHERE plugin_id = ? AND group_id = ?"
    params: list[str] = [plugin_id, group_id]
    if start is not None:
        sql += " AND date >= ?"
        params.append(start)
    if end is not None:
        sql += " AND date <= ?"
        params.append(end)
    rows = conn.execute(sql + " ORDER BY rowid", params).fetchall()
    return [_row_to_entry(row) for row in rows]


def insert_entry(
    conn: sqlite3.Connection, plugin_id: str, group_id: str, entry_id: str, date: str, data: dict, owners: list[str]
) -> dict:
    conn.execute(
        """
        INSERT INTO plugin_entries (id, plugin_id, group_id, date, data_json, owners_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            plugin_id,
            group_id,
            date,
            json.dumps(data, ensure_ascii=False),
            json.dumps(owners, ensure_ascii=False),
        ),
    )
    return {"id": entry_id, "pluginId": plugin_id, "groupId": group_id, "date": date, "data": data, "owners": owners}


def create_entry(
    conn: sqlite3.Connection, manifest: dict, group_id: str, date: str, data: object, owner: str
) -> dict:
    """1 件記録し、連携先へ送る。送信の失敗は記録を残したうえで 502 を返す。"""
    plugin_id = manifest["id"]
    created_hooks = resolve_hooks(manifest, "entry.created")
    achieved_hooks = resolve_hooks(manifest, "goal.achieved")
    with immediate(conn):
        require_group(conn, plugin_id, group_id)
        require_member_of(conn, group_id, owner)
        clean = validate_data(manifest, data)
        before = goal_status(conn, manifest, group_id, date)
        entry = insert_entry(conn, plugin_id, group_id, new_id(plugin_id), date, clean, [owner])
        after = goal_status(conn, manifest, group_id, date)
    event = {
        "plugin": plugin_id,
        "pluginName": manifest["name"],
        "group": group_id,
        "entry": entry,
        "status": after,
    }
    send_hooks(created_hooks, {"event": "entry.created", **event})
    if after["achieved"] and not before["achieved"]:
        send_hooks(achieved_hooks, {"event": "goal.achieved", **event})
    return entry


def delete_entry(
    conn: sqlite3.Connection, plugin_id: str, group_id: str, entry_id: str, user: str, noun: str = "記録"
) -> None:
    with immediate(conn):
        row = conn.execute(
            "SELECT * FROM plugin_entries WHERE id = ? AND plugin_id = ? AND group_id = ?",
            (entry_id, plugin_id, group_id),
        ).fetchone()
        if row is None:
            raise ApiError(404, f"{noun}が見つかりません: {entry_id}")
        entry = _row_to_entry(row)
        if user not in entry["owners"]:
            label = entry["data"].get("title", entry_id)
            raise ApiError(403, f'"{user}" の{noun}ではありません: {label}')
        conn.execute("DELETE FROM plugin_entries WHERE id = ?", (entry_id,))


# ---------- 指標・目標・進捗 ----------


def compute_metric(metric: dict, entries: list[dict]) -> float | int | None:
    where = metric.get("where")
    if where is not None:
        entries = [e for e in entries if e["data"].get(where["field"]) in where["values"]]
    if metric["agg"] == "count":
        return len(entries)
    rule = metric.get("negateWhen")
    values: list[float | int] = []
    for entry in sorted(entries, key=lambda e: e["date"]):
        value = entry["data"].get(metric["field"])
        if value is None:
            continue
        if rule is not None and entry["data"].get(rule["field"]) in rule["values"]:
            value = -value
        values.append(value)
    if metric["agg"] == "sum":
        return sum(values)
    if len(values) == 0:
        return None
    if metric["agg"] == "max":
        return max(values)
    if metric["agg"] == "min":
        return min(values)
    if metric["agg"] == "avg":
        return sum(values) / len(values)
    if metric["agg"] == "delta":
        return values[-1] - values[0]
    return values[-1]


def goal_op(manifest: dict, metric: dict) -> str:
    """目標の向き。指標に op があればそれ（体重は <=）、無ければ goal.op。"""
    return metric.get("op", manifest["goal"]["op"])


def evaluate(op: str, value: float | int | None, target: float | int) -> tuple[bool, float]:
    """達成と進捗（0〜1）。<= で目標が負（-3 kg など）のときは、目標へどれだけ近づいたかで測る。"""
    if value is None:
        return False, 0.0
    if op == ">=":
        achieved = value >= target
        progress = 1.0 if achieved else (max(0.0, value / target) if target > 0 else 0.0)
    else:
        achieved = value <= target
        if achieved:
            progress = 1.0
        elif target < 0:
            progress = max(0.0, value / target) if value < 0 else 0.0
        else:
            progress = max(0.0, target / value) if value > 0 else 0.0
    return achieved, min(1.0, progress)


def _row_to_goal(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "pluginId": row["plugin_id"],
        "groupId": row["group_id"],
        "metric": row["metric"],
        "label": row["label"],
        "start": row["start_date"],
        "end": row["end_date"],
        "target": row["target"],
    }


def fetch_goals(conn: sqlite3.Connection, plugin_id: str, group_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM plugin_goals WHERE plugin_id = ? AND group_id = ? ORDER BY start_date, end_date, rowid",
        (plugin_id, group_id),
    ).fetchall()
    return [_row_to_goal(row) for row in rows]


def save_goal(conn: sqlite3.Connection, goal: dict) -> dict:
    conn.execute(
        """
        INSERT INTO plugin_goals (id, plugin_id, group_id, metric, label, start_date, end_date, target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          metric = excluded.metric, label = excluded.label,
          start_date = excluded.start_date, end_date = excluded.end_date, target = excluded.target
        """,
        (
            goal["id"],
            goal["pluginId"],
            goal["groupId"],
            goal["metric"],
            goal["label"],
            goal["start"],
            goal["end"],
            goal["target"],
        ),
    )
    return goal


def pick_goal(goals: list[dict], at: str) -> dict | None:
    """at の時点で見せる目標。期間中のものか、直前に終わったもの。

    同じ月にテストが 2 回あれば、at に近い方（後に終わった方）を選ぶ。
    期間まで同じ目標が複数あるときは、後から作った方（上書き）が勝つ。
    """
    started = [(g, index) for index, g in enumerate(goals) if g["start"] <= at]
    if len(started) == 0:
        return None
    return max(started, key=lambda pair: (min(pair[0]["end"], at), pair[0]["start"], pair[1]))[0]


def goal_status(conn: sqlite3.Connection, manifest: dict, group_id: str, at: str) -> dict:
    goal = pick_goal(fetch_goals(conn, manifest["id"], group_id), at)
    if goal is None:
        return {"at": at, "goal": None, "op": manifest["goal"]["op"], "value": None, "progress": 0.0, "achieved": False, "finished": False, "effect": pick_effect(manifest, 0.0)}
    metric = next(m for m in manifest["metrics"] if m["key"] == goal["metric"])
    op = goal_op(manifest, metric)
    entries = fetch_entries(conn, manifest["id"], group_id, goal["start"], min(goal["end"], at))
    value = compute_metric(metric, entries)
    achieved, progress = evaluate(op, value, goal["target"])
    return {
        "at": at,
        "goal": goal,
        "op": op,
        "value": value,
        "progress": progress,
        "achieved": achieved,
        "finished": goal["end"] <= at,
        "effect": pick_effect(manifest, progress),
    }


def year_achievements(db_path: Path, plugins_dir: Path, query: str) -> dict:
    """GET /api/achievements?year=YYYY&owner=名前。月ごとに、月末の時点で目標を達成しているプラグイン。
    各プラグインで owner が入っている先頭のグループを見る（画面の島のテーマと同じ選び方）。"""
    raw = _query(query, "year")
    if raw is None or not raw.isdigit() or not 1 <= int(raw) <= 9999:
        raise ApiError(400, f"year は 1〜9999 の整数です: {raw}")
    year = int(raw)
    owner = str(_query(query, "owner"))
    manifests = list_manifests(plugins_dir)
    months: dict[str, list[dict]] = {}
    conn = connect(db_path)
    try:
        own: dict[str, str] = {}
        for m in manifests:
            mine = [g for g in fetch_groups(conn, m["id"]) if owner in g["members"]]
            if len(mine) > 0:
                own[m["id"]] = mine[0]["id"]
        for month in range(1, 13):
            at = f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"
            months[str(month)] = [
                {"id": m["id"], "name": m["name"]}
                for m in manifests
                if m["id"] in own and goal_status(conn, m, own[m["id"]], at)["achieved"]
            ]
    finally:
        conn.close()
    return {"year": year, "months": months}


# ---------- 外部連携の送信 ----------


def read_secret(key: str, where: str) -> str:
    """秘密情報を読む。実行時の環境変数にあればそれ、無ければ secret/.env。どちらにも無ければ止める。"""
    value = os.environ.get(key, "")
    if value != "":
        return value
    if ENV_PATH.is_file():
        for line in ENV_PATH.read_text("utf-8").splitlines():
            text = line.strip()
            if text == "" or text.startswith("#") or "=" not in text:
                continue
            name, raw = text.split("=", 1)
            if name.strip() == key and raw.strip() != "":
                return raw.strip()
    raise ApiError(500, f"{key} が secret/.env にも環境変数にもありません（{where}）")


def resolve_hooks(manifest: dict, on: str) -> list[tuple[dict, str]]:
    """送信先 URL は secret/.env から読む。未設定なら記録の前に止める。"""
    found: list[tuple[dict, str]] = []
    for hook in manifest.get("integrations", []):
        if hook["direction"] != "outgoing" or hook["on"] != on:
            continue
        found.append((hook, read_secret(hook["urlEnv"], f"{manifest['id']} の integration {hook['id']}")))
    return found


def send_hooks(hooks: list[tuple[dict, str]], event: dict) -> None:
    for hook, url in hooks:
        body = json.dumps(ADAPTERS[hook["adapter"]](hook, event), ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "schedule-terrain-map-plugins"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                res.read()
        except urllib.error.URLError as exc:
            raise ApiError(
                502, f"記録 {event['entry']['id']} は保存しました。integration {hook['id']} の送信に失敗しました: {exc}"
            ) from exc


def _pick(payload: object, path: str) -> object:
    current = payload
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ApiError(400, f"受け取った本文に {path} がありません")
        current = current[part]
    return current


# ---------- HTTP ----------


def _object(body: object) -> dict:
    if not isinstance(body, dict):
        raise ApiError(400, "JSON はオブジェクトである必要があります")
    return body


def _text(body: dict, key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or value.strip() == "":
        raise ApiError(400, f"{key} は空でない文字列である必要があります")
    return value.strip()


def _query(query: str, key: str, required: bool = True) -> str | None:
    params = parse_qs(query, keep_blank_values=True)
    if key not in params:
        if required:
            raise ApiError(400, f"{key} がありません")
        return None
    if len(params[key]) != 1 or params[key][0].strip() == "":
        raise ApiError(400, f"{key} は 1 つだけ、空でなく指定してください")
    return params[key][0].strip()


def _allow(method: str, allowed: str, path: str) -> None:
    if method != allowed:
        raise ApiError(405, f"method not allowed: {method} {path}")


def handle(
    method: str,
    path: str,
    query: str,
    headers: object,
    read_body: Callable[[], object],
    db_path: Path,
    plugins_dir: Path,
) -> tuple[int, object]:
    """/api/plugins 以下。戻り値は (HTTP ステータス, JSON)。204 のとき JSON は None。"""
    parts = [unquote(p) for p in path[len("/api/plugins") :].split("/") if p != ""]
    conn = connect(db_path)
    try:
        return _dispatch(conn, method, path, parts, query, headers, read_body, plugins_dir)
    finally:
        conn.close()


def _dispatch(
    conn: sqlite3.Connection,
    method: str,
    path: str,
    parts: list[str],
    query: str,
    headers: object,
    read_body: Callable[[], object],
    plugins_dir: Path,
) -> tuple[int, object]:
    if len(parts) == 0:
        _allow(method, "GET", path)
        return 200, {"plugins": list_manifests(plugins_dir)}
    manifest = load_manifest(parts[0], plugins_dir)
    plugin_id = manifest["id"]
    rest = parts[1:]
    if len(rest) == 0:
        _allow(method, "GET", path)
        return 200, manifest
    if rest[0] != "groups":
        raise ApiError(404, f"not found: {path}")
    if len(rest) == 1:
        if method == "GET":
            return 200, {"groups": fetch_groups(conn, plugin_id)}
        _allow(method, "POST", path)
        body = _object(read_body())
        name = _text(body, "name")
        members = body.get("members")
        if not isinstance(members, list) or len(members) == 0 or not all(isinstance(m, str) for m in members):
            raise ApiError(400, "members は 1 人以上の名前の配列である必要があります")
        group_id = new_id("group")
        with immediate(conn):
            for member in members:
                require_known_member(conn, member)
            save_group(conn, group_id, plugin_id, name)
            for member in members:
                add_group_member(conn, group_id, member)
        return 201, _row_to_group(conn, conn.execute("SELECT * FROM plugin_groups WHERE id = ?", (group_id,)).fetchone())

    group_id = rest[1]
    require_group(conn, plugin_id, group_id)
    match rest[2:]:
        case ["members"]:
            _allow(method, "POST", path)
            member = _text(_object(read_body()), "member")
            with immediate(conn):
                require_known_member(conn, member)
                add_group_member(conn, group_id, member)
            return 200, {"members": group_members(conn, group_id)}
        case ["entries"]:
            if method == "GET":
                start = _query(query, "from", required=False)
                end = _query(query, "to", required=False)
                return 200, {
                    "entries": fetch_entries(
                        conn,
                        plugin_id,
                        group_id,
                        None if start is None else parse_date(start, "from"),
                        None if end is None else parse_date(end, "to"),
                    )
                }
            _allow(method, "POST", path)
            body = _object(read_body())
            date = parse_date(body.get("date"), "date")
            return 201, create_entry(conn, manifest, group_id, date, body.get("data"), _text(body, "owner"))
        case ["entries", entry_id]:
            _allow(method, "DELETE", path)
            delete_entry(conn, plugin_id, group_id, entry_id, str(_query(query, "user")))
            return 204, None
        case ["goals"]:
            if method == "GET":
                return 200, {"goals": fetch_goals(conn, plugin_id, group_id)}
            _allow(method, "POST", path)
            body = _object(read_body())
            require_member_of(conn, group_id, _text(body, "user"))
            metric = body.get("metric", manifest["goal"]["metric"])
            if metric not in [m["key"] for m in manifest["metrics"]]:
                raise ApiError(400, f"metric は {plugin_id} の指標ではありません: {metric}")
            start = parse_date(body.get("start"), "start")
            end = parse_date(body.get("end"), "end")
            if start > end:
                raise ApiError(400, "start は end 以前である必要があります")
            target = body.get("target")
            if not _is_number(target) or not math.isfinite(target):
                raise ApiError(400, "target は数値である必要があります")
            label = body.get("label", "")
            if not isinstance(label, str):
                raise ApiError(400, "label は文字列である必要があります")
            goal = {
                "id": new_id("goal"),
                "pluginId": plugin_id,
                "groupId": group_id,
                "metric": metric,
                "label": label.strip(),
                "start": start,
                "end": end,
                "target": target,
            }
            with immediate(conn):
                save_goal(conn, goal)
            return 201, goal
        case ["goals", goal_id]:
            _allow(method, "DELETE", path)
            require_member_of(conn, group_id, str(_query(query, "user")))
            with immediate(conn):
                cursor = conn.execute(
                    "DELETE FROM plugin_goals WHERE id = ? AND plugin_id = ? AND group_id = ?",
                    (goal_id, plugin_id, group_id),
                )
                if cursor.rowcount != 1:
                    raise ApiError(404, f"目標が見つかりません: {goal_id}")
            return 204, None
        case ["status"]:
            _allow(method, "GET", path)
            at = _query(query, "at", required=False)
            return 200, goal_status(conn, manifest, group_id, today() if at is None else parse_date(at, "at"))
        case ["ingest", hook_id]:
            _allow(method, "POST", path)
            hook = next(
                (h for h in manifest.get("integrations", []) if h["direction"] == "incoming" and h["id"] == hook_id),
                None,
            )
            if hook is None:
                raise ApiError(404, f"受け口が見つかりません: {hook_id}")
            if "tokenEnv" in hook:
                expected = read_secret(hook["tokenEnv"], f"{plugin_id} の受け口 {hook_id}")
                given = getattr(headers, "get")("X-Plugin-Token") or ""
                if not hmac.compare_digest(str(given), expected):
                    raise ApiError(401, "X-Plugin-Token が一致しません")
            payload = read_body()
            data = {field: _pick(payload, source) for field, source in hook["map"].items()}
            date = parse_date(_pick(payload, hook["dateFrom"]), hook["dateFrom"]) if "dateFrom" in hook else today()
            return 201, create_entry(conn, manifest, group_id, date, data, str(_query(query, "user")))
    raise ApiError(404, f"not found: {path}")


def main(argv: list[str]) -> int:
    if len(argv) < 1 or argv[0] != "validate":
        print("使い方: python plugins.py validate [plugin_id ...]", file=sys.stderr)
        return 2
    ids = argv[1:] or [m["id"] for m in list_manifests(PLUGINS_DIR)]
    for plugin_id in ids:
        manifest = load_manifest(plugin_id, PLUGINS_DIR)
        sample = load_sample(manifest, PLUGINS_DIR)
        note = "" if sample is None else f"  sample: 記録 {len(sample.get('entries', []))} 件 / 目標 {len(sample.get('goals', []))} 件"
        print(f"ok  {manifest['id']}@{manifest['version']}  {manifest['name']}{note}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
