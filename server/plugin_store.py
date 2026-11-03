"""管理プラグインのフォーマット。

server/plugins/<id>/ の manifest.json（と任意の sample.json）を読み、
記帳・月目標・達成計算・Webhook・inbound を全プラグイン共通で扱う。
例外は握りつぶさない。
"""

from __future__ import annotations

import json
import re
import secrets
import sqlite3
import time
import urllib.request
from pathlib import Path

import db
from db import LedgerError

PLUGINS_DIR = Path(__file__).resolve().parent / "plugins"
ENV_PATH = Path(__file__).resolve().parent.parent / "secret" / ".env"

ID_PATTERN = re.compile(r"^[a-z0-9_]+$")
FIELD_TYPES = ("number", "choice", "text", "longtext", "tags")
PROGRESS_TYPES = ("number", "choice")
WEBHOOK_EVENTS = ("entry.created", "goal.achieved")
FORMULA_TOKEN = re.compile(r"\s*([+-]|[a-z0-9_:]+)")


# ---------------------------------------------------------------------------
# マニフェストの読み込みと検証（不正なら起動時に例外で止める）
# ---------------------------------------------------------------------------


def _fail(plugin_id: str, message: str) -> Exception:
    return ValueError(f"plugins/{plugin_id}/manifest.json: {message}")


def _require_str(plugin_id: str, data: dict, key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or value.strip() == "":
        raise _fail(plugin_id, f"{key} は空でない文字列である必要があります")
    return value


def _validate_field(plugin_id: str, raw: object) -> dict:
    if not isinstance(raw, dict):
        raise _fail(plugin_id, f"fields の要素がオブジェクトではありません: {raw!r}")
    field_id = _require_str(plugin_id, raw, "id")
    if not ID_PATTERN.match(field_id):
        raise _fail(plugin_id, f"フィールド id は英小文字・数字・アンダースコアだけです: {field_id!r}")
    _require_str(plugin_id, raw, "label")
    field_type = _require_str(plugin_id, raw, "type")
    if field_type not in FIELD_TYPES:
        raise _fail(plugin_id, f"フィールド {field_id} の type が不正です: {field_type!r}")
    role = _require_str(plugin_id, raw, "role")
    expected_role = "progress" if field_type in PROGRESS_TYPES else "memo"
    if role != expected_role:
        raise _fail(
            plugin_id,
            f"フィールド {field_id}（{field_type}）の role は {expected_role} である必要があります: {role!r}",
        )
    if field_type == "choice":
        options = raw.get("options")
        if not isinstance(options, list) or len(options) < 2:
            raise _fail(plugin_id, f"choice フィールド {field_id} には options が 2 つ以上必要です")
        seen: set[str] = set()
        for option in options:
            if not isinstance(option, dict):
                raise _fail(plugin_id, f"フィールド {field_id} の options の要素が不正です: {option!r}")
            value = _require_str(plugin_id, option, "value")
            _require_str(plugin_id, option, "label")
            if value in seen:
                raise _fail(plugin_id, f"フィールド {field_id} の option が重複しています: {value!r}")
            seen.add(value)
    if field_type == "number":
        if "integer" in raw and not isinstance(raw["integer"], bool):
            raise _fail(plugin_id, f"フィールド {field_id} の integer は true/false です")
        if "min" in raw and (isinstance(raw["min"], bool) or not isinstance(raw["min"], (int, float))):
            raise _fail(plugin_id, f"フィールド {field_id} の min は数値です")
    return raw


def _field_map(manifest: dict) -> dict[str, dict]:
    return {field["id"]: field for field in manifest["fields"]}


def parse_formula(plugin_id: str, formula: str, fields: dict[str, dict]) -> list[tuple[int, dict]]:
    """formula を [(符号, 項)] に解釈する。許される項以外が来たら例外で止める。"""

    def number_field(name: str, term: str) -> str:
        field = fields.get(name)
        if field is None or field["type"] != "number":
            raise _fail(plugin_id, f"progress.formula の項 {term!r} が number フィールドを指していません: {name!r}")
        return name

    def parse_term(token: str) -> dict:
        if token == "count":
            return {"op": "count"}
        parts = token.split(":")
        if parts[0] == "sum_if":
            if len(parts) != 4:
                raise _fail(plugin_id, f"progress.formula の項が不正です: {token!r}")
            choice_name, option, number_name = parts[1], parts[2], parts[3]
            choice = fields.get(choice_name)
            if choice is None or choice["type"] != "choice":
                raise _fail(plugin_id, f"progress.formula の項 {token!r} が choice フィールドを指していません")
            if option not in [item["value"] for item in choice["options"]]:
                raise _fail(plugin_id, f"progress.formula の項 {token!r} の選択肢がありません: {option!r}")
            return {"op": "sum_if", "choice": choice_name, "option": option, "field": number_field(number_name, token)}
        if parts[0] in ("sum", "latest", "delta") and len(parts) == 2:
            return {"op": parts[0], "field": number_field(parts[1], token)}
        raise _fail(plugin_id, f"progress.formula を解釈できません: {token!r}")

    text = formula.strip()
    if text == "":
        raise _fail(plugin_id, "progress.formula が空です")
    terms: list[tuple[int, dict]] = []
    sign = 1
    expect_term = True
    pos = 0
    while pos < len(text):
        matched = FORMULA_TOKEN.match(text, pos)
        if matched is None:
            raise _fail(plugin_id, f"progress.formula を解釈できません: {text[pos:]!r}")
        token = matched.group(1)
        pos = matched.end()
        if token in ("+", "-"):
            if expect_term:
                raise _fail(plugin_id, f"progress.formula の演算子の並びが不正です: {formula!r}")
            sign = 1 if token == "+" else -1
            expect_term = True
            continue
        if not expect_term:
            raise _fail(plugin_id, f"progress.formula の項の間に演算子がありません: {formula!r}")
        terms.append((sign, parse_term(token)))
        sign = 1
        expect_term = False
    if expect_term:
        raise _fail(plugin_id, f"progress.formula が項で終わっていません: {formula!r}")
    return terms


def _validate_progress(plugin_id: str, manifest: dict) -> None:
    progress = manifest.get("progress")
    if not isinstance(progress, dict):
        raise _fail(plugin_id, "progress がありません")
    _require_str(plugin_id, progress, "label")
    compare = _require_str(plugin_id, progress, "compare")
    if compare not in ("gte", "lte"):
        raise _fail(plugin_id, f"progress.compare は gte か lte です: {compare!r}")
    goal = progress.get("goal")
    if goal != "per_period":
        if not isinstance(goal, dict) or set(goal.keys()) != {"fixed"}:
            raise _fail(plugin_id, f'progress.goal は "per_period" か {{"fixed": 数値}} です: {goal!r}')
        fixed = goal["fixed"]
        if isinstance(fixed, bool) or not isinstance(fixed, (int, float)):
            raise _fail(plugin_id, f"progress.goal.fixed は数値です: {fixed!r}")
    if "unit" in progress and not isinstance(progress["unit"], str):
        raise _fail(plugin_id, "progress.unit は文字列です")
    parse_formula(plugin_id, _require_str(plugin_id, progress, "formula"), _field_map(manifest))


def _validate_webhooks(plugin_id: str, manifest: dict) -> None:
    webhooks = manifest.get("webhooks")
    if webhooks is None:
        return
    if not isinstance(webhooks, list):
        raise _fail(plugin_id, "webhooks は配列です")
    for hook in webhooks:
        if not isinstance(hook, dict):
            raise _fail(plugin_id, f"webhooks の要素が不正です: {hook!r}")
        on = _require_str(plugin_id, hook, "on")
        if on not in WEBHOOK_EVENTS:
            raise _fail(plugin_id, f"webhooks.on は {WEBHOOK_EVENTS} のどれかです: {on!r}")
        _require_str(plugin_id, hook, "urlEnv")
        body = _require_str(plugin_id, hook, "body")
        if body not in ("json", "discord"):
            raise _fail(plugin_id, f"webhooks.body は json か discord です: {body!r}")
        if body == "discord":
            _require_str(plugin_id, hook, "text")


def _validate_inbound(plugin_id: str, manifest: dict) -> None:
    inbound = manifest.get("inbound")
    if inbound is None:
        return
    if not isinstance(inbound, dict):
        raise _fail(plugin_id, "inbound はオブジェクトです")
    _require_str(plugin_id, inbound, "tokenEnv")
    mapping = inbound.get("map")
    if not isinstance(mapping, dict):
        raise _fail(plugin_id, "inbound.map がありません")
    fields = _field_map(manifest)
    required = {"date", "owner", *fields.keys()}
    if set(mapping.keys()) != required:
        raise _fail(
            plugin_id,
            f"inbound.map のキーは date, owner と全フィールド id である必要があります: {sorted(mapping.keys())!r}",
        )
    for key, value in mapping.items():
        if not isinstance(value, str) or value.strip() == "":
            raise _fail(plugin_id, f"inbound.map.{key} はドットパスの文字列です")


def _validate_manifest(plugin_id: str, manifest: object) -> dict:
    if not isinstance(manifest, dict):
        raise _fail(plugin_id, "manifest.json はオブジェクトである必要があります")
    declared = _require_str(plugin_id, manifest, "id")
    if declared != plugin_id:
        raise _fail(plugin_id, f"id {declared!r} がディレクトリ名 {plugin_id!r} と一致しません")
    if not ID_PATTERN.match(plugin_id):
        raise _fail(plugin_id, "id は英小文字・数字・アンダースコアだけです")
    _require_str(plugin_id, manifest, "title")
    fields = manifest.get("fields")
    if not isinstance(fields, list) or len(fields) == 0:
        raise _fail(plugin_id, "fields が 1 つ以上必要です")
    seen: set[str] = set()
    for raw in fields:
        field = _validate_field(plugin_id, raw)
        if field["id"] in seen:
            raise _fail(plugin_id, f"フィールド id が重複しています: {field['id']!r}")
        seen.add(field["id"])
    _validate_progress(plugin_id, manifest)
    _require_str(plugin_id, manifest, "effect")
    if "achievedLabel" in manifest and not isinstance(manifest["achievedLabel"], str):
        raise _fail(plugin_id, "achievedLabel は文字列です")
    _validate_webhooks(plugin_id, manifest)
    _validate_inbound(plugin_id, manifest)
    return manifest


def load_manifests() -> list[dict]:
    """server/plugins/ の全マニフェスト。並びは id 順で、この並びが画面の既定順になる。"""
    if not PLUGINS_DIR.is_dir():
        raise FileNotFoundError(f"{PLUGINS_DIR} がありません")
    manifests: list[dict] = []
    for entry in sorted(PLUGINS_DIR.iterdir(), key=lambda item: item.name):
        if not entry.is_dir():
            continue
        manifest_path = entry / "manifest.json"
        if not manifest_path.is_file():
            raise FileNotFoundError(f"{manifest_path} がありません")
        manifest = json.loads(manifest_path.read_text("utf-8"))
        manifests.append(_validate_manifest(entry.name, manifest))
    if len(manifests) == 0:
        raise ValueError(f"{PLUGINS_DIR} にプラグインが 1 つもありません")
    return manifests


def get_manifest(plugin_id: str) -> dict:
    for manifest in load_manifests():
        if manifest["id"] == plugin_id:
            return manifest
    raise LedgerError(404, f"プラグインが見つかりません: {plugin_id}")


# ---------------------------------------------------------------------------
# 達成計算（画面側 lib/plugins.ts と同じ意味）
# ---------------------------------------------------------------------------


def _entry_number(entry: dict, field: str) -> float:
    value = entry["values"][field]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"記帳 {entry['id']} の {field} が数値ではありません: {value!r}")
    return value


def period_progress(manifest: dict, entries: list[dict], period_key: str) -> float:
    terms = parse_formula(manifest["id"], manifest["progress"]["formula"], _field_map(manifest))
    prefix = f"{period_key}-"
    month = [entry for entry in entries if str(entry["date"]).startswith(prefix)]
    month.sort(key=lambda entry: entry["date"])  # 安定ソート（同日中は挿入順）
    total = 0.0
    for sign, term in terms:
        if term["op"] == "count":
            value = float(len(month))
        elif term["op"] == "sum":
            value = sum(_entry_number(entry, term["field"]) for entry in month)
        elif term["op"] == "sum_if":
            value = sum(
                _entry_number(entry, term["field"])
                for entry in month
                if entry["values"][term["choice"]] == term["option"]
            )
        elif term["op"] == "latest":
            value = _entry_number(month[-1], term["field"]) if month else 0.0
        else:  # delta
            value = (_entry_number(month[-1], term["field"]) - _entry_number(month[0], term["field"])) if month else 0.0
        total += sign * value
    return total


def period_goal(manifest: dict, goals: dict[str, int], period_key: str) -> float | None:
    goal = manifest["progress"]["goal"]
    if goal == "per_period":
        return goals.get(period_key)
    return goal["fixed"]


def is_achieved(manifest: dict, progress: float, goal: float | None) -> bool:
    if goal is None:
        return False
    if manifest["progress"]["compare"] == "gte":
        return progress >= goal
    return progress <= goal


# ---------------------------------------------------------------------------
# 保存（plugin_entries / plugin_goals）
# ---------------------------------------------------------------------------


def _row_to_entry(row: sqlite3.Row) -> dict:
    values = json.loads(row["values_json"])
    if not isinstance(values, dict):
        raise ValueError(f"values_json がオブジェクトではありません: {row['id']}")
    return {
        "id": row["id"],
        "date": row["date"],
        "owners": db._owners(row["id"], row["owners_json"]),
        "values": values,
    }


def _plugin_entries(conn: sqlite3.Connection, plugin_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, date, owners_json, values_json FROM plugin_entries WHERE plugin_id = ? ORDER BY rowid",
        (plugin_id,),
    ).fetchall()
    return [_row_to_entry(row) for row in rows]


def _plugin_goals(conn: sqlite3.Connection, plugin_id: str) -> dict[str, int]:
    rows = conn.execute(
        "SELECT period_key, amount FROM plugin_goals WHERE plugin_id = ? ORDER BY period_key",
        (plugin_id,),
    ).fetchall()
    return {row["period_key"]: row["amount"] for row in rows}


def _snapshot(conn: sqlite3.Connection, manifest: dict) -> dict:
    return {
        "manifest": manifest,
        "entries": _plugin_entries(conn, manifest["id"]),
        "goals": _plugin_goals(conn, manifest["id"]),
    }


def fetch_plugins(path: Path) -> dict:
    manifests = load_manifests()
    conn = db.connect(path)
    try:
        return {"plugins": [_snapshot(conn, manifest) for manifest in manifests]}
    finally:
        conn.close()


def _insert_entry(conn: sqlite3.Connection, plugin_id: str, entry: dict) -> None:
    conn.execute(
        "INSERT INTO plugin_entries (id, plugin_id, date, owners_json, values_json) VALUES (?, ?, ?, ?, ?)",
        (
            entry["id"],
            plugin_id,
            entry["date"],
            json.dumps(entry["owners"], ensure_ascii=False),
            json.dumps(entry["values"], ensure_ascii=False),
        ),
    )


def _validate_values(manifest: dict, raw: object) -> dict:
    if not isinstance(raw, dict):
        raise LedgerError(400, "values はオブジェクトである必要があります")
    fields = _field_map(manifest)
    unknown = sorted(set(raw.keys()) - set(fields.keys()))
    if unknown:
        raise LedgerError(400, f"values に未定義のフィールドがあります: {unknown}")
    values: dict = {}
    for field_id, field in fields.items():
        if field_id not in raw:
            raise LedgerError(400, f"values.{field_id} がありません")
        value = raw[field_id]
        if field["type"] == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise LedgerError(400, f"values.{field_id} は数値である必要があります")
            if field.get("integer", False) and not isinstance(value, int):
                raise LedgerError(400, f"values.{field_id} は整数である必要があります")
            minimum = field.get("min")
            if minimum is not None and value < minimum:
                raise LedgerError(400, f"values.{field_id} は {minimum} 以上である必要があります")
        elif field["type"] == "choice":
            allowed = [option["value"] for option in field["options"]]
            if value not in allowed:
                raise LedgerError(400, f"values.{field_id} は {allowed} のどれかである必要があります")
        elif field["type"] == "tags":
            if not isinstance(value, list) or any(not isinstance(item, str) or item.strip() == "" for item in value):
                raise LedgerError(400, f"values.{field_id} は空でない文字列の配列である必要があります")
            value = [item.strip() for item in value]
        else:  # text / longtext
            if not isinstance(value, str):
                raise LedgerError(400, f"values.{field_id} は文字列である必要があります")
            value = value.strip()
            if field["type"] == "text" and value == "":
                raise LedgerError(400, f"values.{field_id} が空です")
        values[field_id] = value
    return values


def new_entry_id(plugin_id: str) -> str:
    unix_ms = int(time.time() * 1000)
    rand = secrets.randbelow(1_000_000)
    return f"{plugin_id}-{unix_ms}-{rand}"


def add_entry(path: Path, plugin_id: str, body: object) -> dict:
    manifest = get_manifest(plugin_id)
    payload = db._require_object(body)
    entry = {
        "id": new_entry_id(plugin_id),
        "date": db._require_date(payload),
        "owners": [db._require_text(payload, "owner")],
        "values": _validate_values(manifest, db._require_present(payload, "values")),
    }
    conn = db.connect(path)
    try:
        with db._immediate(conn):
            before = _period_state(conn, manifest, entry["date"])
            _insert_entry(conn, plugin_id, entry)
            after = _period_state(conn, manifest, entry["date"])
    finally:
        conn.close()
    _send_webhooks(manifest, entry, before, after, created=True)
    return entry


def _period_state(conn: sqlite3.Connection, manifest: dict, date: str) -> dict:
    period_key = date[:7]
    entries = _plugin_entries(conn, manifest["id"])
    goals = _plugin_goals(conn, manifest["id"])
    progress = period_progress(manifest, entries, period_key)
    goal = period_goal(manifest, goals, period_key)
    return {
        "period": period_key,
        "progress": progress,
        "goal": goal,
        "achieved": is_achieved(manifest, progress, goal),
    }


def _memo_label(manifest: dict, entry: dict) -> str:
    for field in manifest["fields"]:
        if field["role"] == "memo" and field["type"] in ("text", "longtext"):
            value = entry["values"].get(field["id"])
            if isinstance(value, str) and value != "":
                return value
    return entry["id"]


def delete_entry(path: Path, plugin_id: str, entry_id: str, user: str) -> None:
    manifest = get_manifest(plugin_id)
    conn = db.connect(path)
    try:
        with db._immediate(conn):
            row = conn.execute(
                "SELECT id, date, owners_json, values_json FROM plugin_entries WHERE plugin_id = ? AND id = ?",
                (plugin_id, entry_id),
            ).fetchone()
            if row is None:
                raise LedgerError(404, f"記帳が見つかりません: {entry_id}")
            entry = _row_to_entry(row)
            if user not in entry["owners"]:
                raise LedgerError(403, f'"{user}" の記帳ではありません: {_memo_label(manifest, entry)}')
            cursor = conn.execute(
                "DELETE FROM plugin_entries WHERE plugin_id = ? AND id = ?", (plugin_id, entry_id)
            )
            if cursor.rowcount != 1:
                raise LedgerError(404, f"記帳が見つかりません: {entry_id}")
    finally:
        conn.close()


def set_goal(path: Path, plugin_id: str, body: object) -> dict:
    manifest = get_manifest(plugin_id)
    if manifest["progress"]["goal"] != "per_period":
        raise LedgerError(400, f"プラグイン {plugin_id} の目標は固定値です。月ごとの目標は変えられません")
    payload = db._require_object(body)
    year = db._require_int(payload, "year")
    month = db._require_int(payload, "month")
    amount = db._require_positive_int(payload, "amount")
    if month < 1 or month > 12:
        raise LedgerError(400, "month は 1 から 12 である必要があります")
    if year < 0 or year > 9999:
        raise LedgerError(400, "year は 0 から 9999 である必要があります")
    period_key = f"{year:04d}-{month:02d}"
    conn = db.connect(path)
    try:
        with db._immediate(conn):
            before = _period_state(conn, manifest, f"{period_key}-01")
            conn.execute(
                """
                INSERT INTO plugin_goals (plugin_id, period_key, amount)
                VALUES (?, ?, ?)
                ON CONFLICT(plugin_id, period_key) DO UPDATE SET amount = excluded.amount
                """,
                (plugin_id, period_key, amount),
            )
            after = _period_state(conn, manifest, f"{period_key}-01")
    finally:
        conn.close()
    _send_webhooks(manifest, None, before, after, created=False)
    return {"plugin": plugin_id, "yearMonth": period_key, "amount": amount}


# ---------------------------------------------------------------------------
# Webhook と inbound
# ---------------------------------------------------------------------------


def _load_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        raise LedgerError(502, f"{ENV_PATH} がありません。secret/.env.template を基に作成してください")
    values: dict[str, str] = {}
    for line in ENV_PATH.read_text("utf-8").splitlines():
        text = line.strip()
        if text == "" or text.startswith("#") or "=" not in text:
            continue
        key, _, value = text.partition("=")
        values[key.strip()] = value.strip()
    return values


def _require_env(key: str) -> str:
    value = _load_env().get(key, "")
    if value == "":
        raise LedgerError(502, f"secret/.env に {key} が設定されていません")
    return value


def _render_discord(text: str, manifest: dict, state: dict) -> str:
    goal = state["goal"]
    replacements = {
        "{plugin}": manifest["id"],
        "{title}": manifest["title"],
        "{period}": state["period"],
        "{progress}": str(state["progress"]),
        "{goal}": "" if goal is None else str(goal),
    }
    rendered = text
    for key, value in replacements.items():
        rendered = rendered.replace(key, value)
    return rendered


def _post_json(url: str, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=10):
        pass


def _send_webhooks(
    manifest: dict,
    entry: dict | None,
    before: dict,
    after: dict,
    *,
    created: bool,
) -> None:
    """保存後に呼ぶ。失敗は 502。保存済みの記帳・目標は消さない。"""
    hooks = manifest.get("webhooks") or []
    newly_achieved = after["achieved"] and not before["achieved"]
    for hook in hooks:
        if hook["on"] == "entry.created" and not created:
            continue
        if hook["on"] == "goal.achieved" and not newly_achieved:
            continue
        try:
            url = _require_env(hook["urlEnv"])
            if hook["body"] == "discord":
                payload: dict = {"content": _render_discord(hook["text"], manifest, after)}
            else:
                payload = {
                    "plugin": manifest["id"],
                    "event": hook["on"],
                    "period": after["period"],
                    "progress": after["progress"],
                    "goal": after["goal"],
                }
                if entry is not None:
                    payload["entry"] = entry
            _post_json(url, payload)
        except LedgerError:
            raise
        except Exception as exc:
            raise LedgerError(502, f"webhook {hook['urlEnv']} の送信に失敗しました: {exc}") from exc


def _dot_path(body: dict, path: str) -> object:
    current: object = body
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise LedgerError(400, f"受信 JSON に {path} がありません")
        current = current[part]
    return current


def inbound(path: Path, plugin_id: str, token: str | None, body: object) -> dict:
    manifest = get_manifest(plugin_id)
    config = manifest.get("inbound")
    if config is None:
        raise LedgerError(404, f"プラグイン {plugin_id} は inbound を受け付けません")
    expected = _require_env(config["tokenEnv"])
    if token is None or not secrets.compare_digest(token, expected):
        raise LedgerError(403, "X-Plugin-Token が一致しません")
    payload = db._require_object(body)
    mapping = config["map"]
    date = _dot_path(payload, mapping["date"])
    owner = _dot_path(payload, mapping["owner"])
    values = {
        field_id: _dot_path(payload, dot)
        for field_id, dot in mapping.items()
        if field_id not in ("date", "owner")
    }
    return add_entry(path, plugin_id, {"date": date, "owner": owner, "values": values})


# ---------------------------------------------------------------------------
# 起動時の準備（移行とサンプル投入）とリセット
# ---------------------------------------------------------------------------


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
    ).fetchone()
    return row["n"] > 0


def _plugin_is_empty(conn: sqlite3.Connection, plugin_id: str) -> bool:
    entries = conn.execute(
        "SELECT COUNT(*) AS n FROM plugin_entries WHERE plugin_id = ?", (plugin_id,)
    ).fetchone()["n"]
    goals = conn.execute(
        "SELECT COUNT(*) AS n FROM plugin_goals WHERE plugin_id = ?", (plugin_id,)
    ).fetchone()["n"]
    return entries == 0 and goals == 0


def _migrate_legacy_ledger(conn: sqlite3.Connection, manifests: list[dict]) -> None:
    """旧 ledger_entries / monthly_goals を ledger プラグインへ移す。移したあとは参照しない。"""
    if not any(manifest["id"] == "ledger" for manifest in manifests):
        return
    if not _plugin_is_empty(conn, "ledger"):
        return
    if _table_exists(conn, "ledger_entries"):
        rows = conn.execute(
            "SELECT id, date, kind, amount, title, owners_json FROM ledger_entries ORDER BY rowid"
        ).fetchall()
        for row in rows:
            _insert_entry(
                conn,
                "ledger",
                {
                    "id": row["id"],
                    "date": row["date"],
                    "owners": db._owners(row["id"], row["owners_json"]),
                    "values": {"kind": row["kind"], "amount": row["amount"], "title": row["title"]},
                },
            )
    if _table_exists(conn, "monthly_goals"):
        rows = conn.execute("SELECT year_month, amount FROM monthly_goals ORDER BY year_month").fetchall()
        conn.executemany(
            "INSERT OR IGNORE INTO plugin_goals (plugin_id, period_key, amount) VALUES ('ledger', ?, ?)",
            [(row["year_month"], row["amount"]) for row in rows],
        )


def _sample(plugin_id: str) -> dict | None:
    sample_path = PLUGINS_DIR / plugin_id / "sample.json"
    if not sample_path.is_file():
        return None
    data = json.loads(sample_path.read_text("utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("entries"), list) or not isinstance(data.get("goals"), dict):
        raise ValueError(f"{sample_path} は entries と goals を持つオブジェクトである必要があります")
    return data


def _insert_sample(conn: sqlite3.Connection, manifest: dict) -> None:
    sample = _sample(manifest["id"])
    if sample is None:
        return
    for raw in sample["entries"]:
        entry = {
            "id": raw["id"],
            "date": raw["date"],
            "owners": raw["owners"],
            "values": _validate_values_startup(manifest, raw["values"]),
        }
        _insert_entry(conn, manifest["id"], entry)
    conn.executemany(
        "INSERT INTO plugin_goals (plugin_id, period_key, amount) VALUES (?, ?, ?)",
        [(manifest["id"], key, amount) for key, amount in sample["goals"].items()],
    )


def _validate_values_startup(manifest: dict, raw: object) -> dict:
    """sample.json の values 検証。不正なら起動時に止める。"""
    try:
        return _validate_values(manifest, raw)
    except LedgerError as exc:
        raise ValueError(f"plugins/{manifest['id']}/sample.json: {exc}") from exc


def ensure_ready(path: Path) -> None:
    """マニフェストを検証し、旧家計簿の移行と、空プラグインへのサンプル投入を行う。"""
    manifests = load_manifests()
    conn = db.connect(path)
    try:
        with db._immediate(conn):
            _migrate_legacy_ledger(conn, manifests)
            for manifest in manifests:
                if _plugin_is_empty(conn, manifest["id"]):
                    _insert_sample(conn, manifest)
    finally:
        conn.close()


def reset_demo(path: Path) -> dict:
    """予定・メンバー・全プラグインをサンプルで作り直す。"""
    manifests = load_manifests()
    conn = db.connect(path)
    try:
        with db._immediate(conn):
            conn.execute("DELETE FROM plugin_entries")
            conn.execute("DELETE FROM plugin_goals")
            conn.execute("DELETE FROM events")
            conn.execute("DELETE FROM members")
            db._insert_calendar(conn)
            for manifest in manifests:
                _insert_sample(conn, manifest)
        snapshot = db._calendar_snapshot(conn)
        snapshot["plugins"] = [_snapshot(conn, manifest) for manifest in manifests]
        return snapshot
    finally:
        conn.close()
