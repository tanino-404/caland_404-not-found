"""SQLite のスキーマと予定・メンバーの読み書き。例外は握りつぶさない。

家計簿は管理内容プラグイン（plugins/ledger）として plugin_* テーブルに入る。
旧テーブル（ledger_entries / monthly_goals）が残っていれば起動時に移し替えて捨てる。
"""

from __future__ import annotations

import calendar
import hashlib
import hmac
import json
import random
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path

import plugins
import seed

SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
  name TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL DEFAULT '',
  salt TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN (
    'beauty','restaurant','work','wedding','hospital','gym','travel','school'
  )),
  owners_json TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT ''
);
"""

LEDGER_PLUGIN_ID = "ledger"

CATEGORIES = (
    "beauty",
    "restaurant",
    "work",
    "wedding",
    "hospital",
    "gym",
    "travel",
    "school",
)


# テストで「今日」を固定するときだけ 'YYYY-MM-DD' を入れる。None ならサーバーのローカルの今日。
TODAY_OVERRIDE: str | None = None


def _today() -> str:
    """サンプル家計を DB に入れるときの「今日」（YYYY-MM-DD）。"""
    if TODAY_OVERRIDE is not None:
        return TODAY_OVERRIDE
    return date.today().isoformat()


class LedgerError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def _immediate(conn: sqlite3.Connection):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
    except Exception:
        conn.rollback()
        raise
    else:
        conn.commit()


def _ledger_empty(conn: sqlite3.Connection) -> bool:
    entries = conn.execute(
        "SELECT COUNT(*) AS n FROM plugin_entries WHERE plugin_id = ?", (LEDGER_PLUGIN_ID,)
    ).fetchone()["n"]
    goals = conn.execute(
        "SELECT COUNT(*) AS n FROM plugin_goals WHERE plugin_id = ?", (LEDGER_PLUGIN_ID,)
    ).fetchone()["n"]
    return entries == 0 and goals == 0


def _calendar_empty(conn: sqlite3.Connection) -> bool:
    members = conn.execute("SELECT COUNT(*) AS n FROM members").fetchone()["n"]
    events = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    return members == 0 and events == 0


def _month_bounds(year_month: str) -> tuple[str, str]:
    year, month = (int(part) for part in year_month.split("-"))
    last = calendar.monthrange(year, month)[1]
    return f"{year_month}-01", f"{year_month}-{last:02d}"


def _ledger_group_id(conn: sqlite3.Connection, member: str) -> str:
    """家計簿はメンバーごとに 1 グループ（{member}の家計簿）。無ければ作る。id は登録順。"""
    name = f"{member}の家計簿"
    for group in plugins.fetch_groups(conn, LEDGER_PLUGIN_ID):
        if group["name"] == name:
            return group["id"]
    group_id = f"{LEDGER_PLUGIN_ID}-member-{len(plugins.fetch_groups(conn, LEDGER_PLUGIN_ID)) + 1}"
    plugins.save_group(conn, group_id, LEDGER_PLUGIN_ID, name)
    plugins.add_group_member(conn, group_id, member)
    return group_id


def _ledger_goal(group_id: str, year_month: str, amount: int) -> dict:
    start, end = _month_bounds(year_month)
    return {
        "id": f"goal-{group_id}-{year_month}",
        "pluginId": LEDGER_PLUGIN_ID,
        "groupId": group_id,
        "metric": "savings",
        "label": f"{int(year_month[5:7])}月の貯金目標",
        "start": start,
        "end": end,
        "target": amount,
    }


def _insert_ledger_entry(conn: sqlite3.Connection, entry: dict) -> None:
    owners = entry["owners"]
    plugins.insert_entry(
        conn,
        LEDGER_PLUGIN_ID,
        _ledger_group_id(conn, owners[0]),
        entry["id"],
        entry["date"],
        {"kind": entry["kind"], "amount": entry["amount"], "title": entry["title"]},
        owners,
    )


def _insert_sample(conn: sqlite3.Connection) -> None:
    """サンプル家計を入れる。今日より後の記帳は入れない（先の月が達成済みに見えないように）。
    月目標は全期間入れる。記帳の無い先の月は貯金 0 で未達になる。"""
    entries, goals = seed.build_sample()
    today = _today()
    for member in seed.SAMPLE_MEMBERS:
        _ledger_group_id(conn, member)
    for entry in entries:
        if entry["date"] <= today:
            _insert_ledger_entry(conn, entry)
    for member, by_month in goals.items():
        group_id = _ledger_group_id(conn, member)
        for year_month, amount in by_month.items():
            plugins.save_goal(conn, _ledger_goal(group_id, year_month, amount))


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
    ).fetchone()
    return row is not None


def _migrate_old_ledger(conn: sqlite3.Connection) -> None:
    """旧テーブル（ledger_entries / monthly_goals）をプラグイン形式（メンバーごとのグループ）へ移し替えて捨てる。
    monthly_goals に owner 列が無い旧形式の目標は、全員共通の目標なので全メンバーに複製する。"""
    if not _table_exists(conn, "ledger_entries"):
        return
    if _ledger_empty(conn):
        rows = conn.execute(
            "SELECT id, date, kind, amount, title, owners_json FROM ledger_entries ORDER BY rowid"
        ).fetchall()
        for row in rows:
            _insert_ledger_entry(
                conn,
                {
                    "id": row["id"],
                    "date": row["date"],
                    "kind": row["kind"],
                    "amount": row["amount"],
                    "title": row["title"],
                    "owners": _owners(row["id"], row["owners_json"]),
                },
            )
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(monthly_goals)")]
        if "owner" in columns:
            goal_rows = conn.execute(
                "SELECT owner, year_month, amount FROM monthly_goals ORDER BY owner, year_month"
            ).fetchall()
            pairs = [(row["owner"], row) for row in goal_rows]
        else:
            goal_rows = conn.execute("SELECT year_month, amount FROM monthly_goals ORDER BY year_month").fetchall()
            pairs = [(member, row) for member in _member_names(conn) for row in goal_rows]
        for member, row in pairs:
            plugins.save_goal(conn, _ledger_goal(_ledger_group_id(conn, member), row["year_month"], row["amount"]))
    conn.execute("DROP TABLE ledger_entries")
    conn.execute("DROP TABLE IF EXISTS monthly_goals")


def _hash_password(password: str, salt: str) -> str:
    """PBKDF2-HMAC-SHA256 を 100,000 回。salt は secrets.token_hex(16) の 32 文字。"""
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def _new_salt() -> str:
    return secrets.token_hex(16)


def _insert_member(conn: sqlite3.Connection, name: str, password: str) -> None:
    salt = _new_salt()
    conn.execute(
        "INSERT INTO members (name, password_hash, salt) VALUES (?, ?, ?)",
        (name, _hash_password(password, salt), salt),
    )


def _insert_calendar(conn: sqlite3.Connection) -> None:
    members, events = seed.build_sample_events()
    for name in members:
        _insert_member(conn, name, seed.SAMPLE_PASSWORD)
    conn.executemany(
        """
        INSERT INTO events (id, date, title, category, owners_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                event["id"],
                event["date"],
                event["title"],
                event["category"],
                json.dumps(event["owners"], ensure_ascii=False),
            )
            for event in events
        ],
    )


def _owners(entry_id: str, raw: str) -> list:
    owners = json.loads(raw)
    if not isinstance(owners, list):
        raise ValueError(f"owners_json が配列ではありません: {entry_id}")
    return owners


def _ensure_events_place(conn: sqlite3.Connection) -> None:
    """既存 DB の events に place 列が無ければ足す（作成済み DB の移行）。"""
    columns = [row["name"] for row in conn.execute("PRAGMA table_info(events)")]
    if "place" not in columns:
        conn.execute("ALTER TABLE events ADD COLUMN place TEXT NOT NULL DEFAULT ''")


def _insert_plugin_samples(conn: sqlite3.Connection, plugins_dir: Path) -> None:
    """家計以外で、まだグループが無いプラグインに sample.json を入れる。"""
    for manifest in plugins.list_manifests(plugins_dir):
        if manifest["id"] == LEDGER_PLUGIN_ID or plugins.plugin_has_groups(conn, manifest["id"]):
            continue
        sample = plugins.load_sample(manifest, plugins_dir)
        if sample is not None:
            plugins.insert_sample(conn, manifest, sample)


def _ensure_members_password(conn: sqlite3.Connection) -> None:
    """既存 DB の members に password_hash / salt 列が無ければ足し、
    パスワード未設定のメンバーには初期パスワード（seed.SAMPLE_PASSWORD）を入れる。"""
    columns = [row["name"] for row in conn.execute("PRAGMA table_info(members)")]
    if "password_hash" not in columns:
        conn.execute("ALTER TABLE members ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    if "salt" not in columns:
        conn.execute("ALTER TABLE members ADD COLUMN salt TEXT NOT NULL DEFAULT ''")
    rows = conn.execute("SELECT name FROM members WHERE password_hash = ''").fetchall()
    for row in rows:
        salt = _new_salt()
        conn.execute(
            "UPDATE members SET password_hash = ?, salt = ? WHERE name = ?",
            (_hash_password(seed.SAMPLE_PASSWORD, salt), salt, row["name"]),
        )


def ensure_ready(path: Path, plugins_dir: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    try:
        conn.executescript(SCHEMA)
        conn.executescript(plugins.SCHEMA)
        with _immediate(conn):
            _ensure_events_place(conn)
            _ensure_members_password(conn)
            if _calendar_empty(conn):
                _insert_calendar(conn)
            _migrate_old_ledger(conn)
            if _ledger_empty(conn):
                _insert_sample(conn)
            _insert_plugin_samples(conn, plugins_dir)
            plugins.sync_installs(conn, plugins.list_manifests(plugins_dir))
    finally:
        conn.close()


def _require_object(body: object) -> dict:
    if not isinstance(body, dict):
        raise LedgerError(400, "JSON はオブジェクトである必要があります")
    return body


def _require_present(body: dict, key: str) -> object:
    if key not in body:
        raise LedgerError(400, f"{key} がありません")
    return body[key]


def _require_text(body: dict, key: str) -> str:
    value = _require_present(body, key)
    if not isinstance(value, str):
        raise LedgerError(400, f"{key} は文字列である必要があります")
    text = value.strip()
    if text == "":
        raise LedgerError(400, f"{key} が空です")
    return text


def _require_date(body: dict) -> str:
    value = _require_present(body, "date")
    if not isinstance(value, str):
        raise LedgerError(400, "date は YYYY-MM-DD である必要があります")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise LedgerError(400, str(exc)) from exc
    if parsed.strftime("%Y-%m-%d") != value:
        raise LedgerError(400, "date は YYYY-MM-DD である必要があります")
    return value


def _member_names(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT name FROM members ORDER BY rowid").fetchall()
    return [row["name"] for row in rows]


def _row_to_event(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "title": row["title"],
        "category": row["category"],
        "owners": _owners(row["id"], row["owners_json"]),
        "place": row["place"],
    }


def _calendar_snapshot(conn: sqlite3.Connection) -> dict:
    rows = conn.execute(
        "SELECT id, date, title, category, owners_json, place FROM events ORDER BY rowid"
    ).fetchall()
    return {"members": _member_names(conn), "events": [_row_to_event(row) for row in rows]}


def fetch_calendar(path: Path) -> dict:
    conn = connect(path)
    try:
        return _calendar_snapshot(conn)
    finally:
        conn.close()


def _require_category(body: dict) -> str:
    value = _require_present(body, "category")
    if value not in CATEGORIES:
        raise LedgerError(400, "category は予定の種類のいずれかである必要があります")
    return value


def _optional_text(body: dict, key: str) -> str:
    """任意の文字列項目。無ければ空文字、あれば前後の空白を落とす。"""
    if key not in body:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise LedgerError(400, f"{key} は文字列である必要があります")
    return value.strip()


def _require_name_list(body: dict, key: str) -> list[str]:
    value = _require_present(body, key)
    if not isinstance(value, list):
        raise LedgerError(400, f"{key} は配列である必要があります")
    names: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise LedgerError(400, f"{key} は文字列の配列である必要があります")
        text = item.strip()
        if text == "":
            raise LedgerError(400, f"{key} に空の名前があります")
        if text not in names:
            names.append(text)
    return names


def _require_member(names: list[str], name: str) -> None:
    if name not in names:
        raise LedgerError(400, f'"{name}" はメンバーではありません')


def new_event_id() -> str:
    unix_ms = int(time.time() * 1000)
    rand = random.randrange(1_000_000)
    return f"event-{unix_ms}-{rand}"


NAME_MAX = 12
PASSWORD_MIN = 4
PASSWORD_MAX = 64
LOGIN_FAILED = "IDまたはパスワードが違います"


def _require_password(body: dict) -> str:
    """password は文字列のまま受け取る（前後の空白も落とさない）。"""
    value = _require_present(body, "password")
    if not isinstance(value, str):
        raise LedgerError(400, "password は文字列である必要があります")
    return value


def login_member(path: Path, body: object) -> dict:
    """ID（名前）とパスワードを検証する。名前が無い場合もパスワード不一致と同じ 401。"""
    payload = _require_object(body)
    name = _require_text(payload, "name")
    password = _require_password(payload)
    conn = connect(path)
    try:
        row = conn.execute(
            "SELECT password_hash, salt FROM members WHERE name = ?",
            (name,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise LedgerError(401, LOGIN_FAILED)
    expected = str(row["password_hash"])
    actual = _hash_password(password, str(row["salt"]))
    if not hmac.compare_digest(expected, actual):
        raise LedgerError(401, LOGIN_FAILED)
    return {"name": name}


def register_member(path: Path, body: object) -> dict:
    """新しいメンバーを ID（名前）とパスワードで登録する。"""
    payload = _require_object(body)
    name = _require_text(payload, "name")
    if len(name) > NAME_MAX:
        raise LedgerError(400, f"name は {NAME_MAX} 文字以内である必要があります")
    password = _require_password(payload)
    if len(password) < PASSWORD_MIN or len(password) > PASSWORD_MAX:
        raise LedgerError(
            400,
            f"password は {PASSWORD_MIN} 文字以上 {PASSWORD_MAX} 文字以内である必要があります",
        )
    conn = connect(path)
    try:
        with _immediate(conn):
            exists = conn.execute("SELECT 1 FROM members WHERE name = ?", (name,)).fetchone()
            if exists is not None:
                raise LedgerError(409, "この ID はもう使われています")
            _insert_member(conn, name, password)
        return {"name": name}
    finally:
        conn.close()


def add_event(path: Path, body: object) -> dict:
    payload = _require_object(body)
    date = _require_date(payload)
    title = _require_text(payload, "title")
    category = _require_category(payload)
    owner = _require_text(payload, "owner")
    place = _optional_text(payload, "place")
    invited = [name for name in _require_name_list(payload, "invited") if name != owner]
    event = {
        "id": new_event_id(),
        "date": date,
        "title": title,
        "category": category,
        "owners": [owner, *invited],
        "place": place,
    }
    conn = connect(path)
    try:
        with _immediate(conn):
            names = _member_names(conn)
            _require_member(names, owner)
            for name in invited:
                _require_member(names, name)
            conn.execute(
                """
                INSERT INTO events (id, date, title, category, owners_json, place)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event["id"],
                    event["date"],
                    event["title"],
                    event["category"],
                    json.dumps(event["owners"], ensure_ascii=False),
                    event["place"],
                ),
            )
        return event
    finally:
        conn.close()


def _event_row(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, date, title, category, owners_json, place FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    if row is None:
        raise LedgerError(404, f"予定が見つかりません: {event_id}")
    return row


def join_event(path: Path, event_id: str, body: object) -> dict:
    payload = _require_object(body)
    user = _require_text(payload, "user")
    conn = connect(path)
    try:
        with _immediate(conn):
            _require_member(_member_names(conn), user)
            row = _event_row(conn, event_id)
            owners = _owners(row["id"], row["owners_json"])
            if user not in owners:
                owners = [*owners, user]
                conn.execute(
                    "UPDATE events SET owners_json = ? WHERE id = ?",
                    (json.dumps(owners, ensure_ascii=False), event_id),
                )
            updated = _event_row(conn, event_id)
        return _row_to_event(updated)
    finally:
        conn.close()


def leave_event(path: Path, event_id: str, body: object) -> dict:
    payload = _require_object(body)
    user = _require_text(payload, "user")
    conn = connect(path)
    try:
        with _immediate(conn):
            row = _event_row(conn, event_id)
            owners = _owners(row["id"], row["owners_json"])
            if user not in owners:
                raise LedgerError(403, f'"{user}" の予定ではありません: {row["title"]}')
            remaining = [owner for owner in owners if owner != user]
            if len(remaining) == 0:
                cursor = conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
                if cursor.rowcount != 1:
                    raise LedgerError(404, f"予定が見つかりません: {event_id}")
                return {"event": None}
            conn.execute(
                "UPDATE events SET owners_json = ? WHERE id = ?",
                (json.dumps(remaining, ensure_ascii=False), event_id),
            )
            updated = _row_to_event(_event_row(conn, event_id))
        return {"event": updated}
    finally:
        conn.close()


def reset_demo(path: Path, plugins_dir: Path) -> dict:
    """予定・メンバー・全プラグインの記録をサンプルで作り直す。"""
    conn = connect(path)
    try:
        with _immediate(conn):
            conn.execute("DELETE FROM events")
            conn.execute("DELETE FROM members")
            plugins.delete_plugin_data(conn)
            _insert_calendar(conn)
            _insert_sample(conn)
            _insert_plugin_samples(conn, plugins_dir)
        return _calendar_snapshot(conn)
    finally:
        conn.close()
