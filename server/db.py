"""SQLite のスキーマと、予定・メンバーの読み書き。例外は握りつぶさない。

管理プラグイン（記帳・月目標）の読み書きは plugin_store.py。
"""

from __future__ import annotations

import json
import random
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

import seed

SCHEMA = """
CREATE TABLE IF NOT EXISTS plugin_entries (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  date TEXT NOT NULL,
  owners_json TEXT NOT NULL,
  values_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plugin_goals (
  plugin_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 1),
  PRIMARY KEY (plugin_id, period_key)
);
CREATE TABLE IF NOT EXISTS members (
  name TEXT PRIMARY KEY
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


def _calendar_empty(conn: sqlite3.Connection) -> bool:
    members = conn.execute("SELECT COUNT(*) AS n FROM members").fetchone()["n"]
    events = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    return members == 0 and events == 0


def _insert_calendar(conn: sqlite3.Connection) -> None:
    members, events = seed.build_sample_events()
    conn.executemany("INSERT INTO members (name) VALUES (?)", [(name,) for name in members])
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


def ensure_ready(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    try:
        conn.executescript(SCHEMA)
        with _immediate(conn):
            _ensure_events_place(conn)
            if _calendar_empty(conn):
                _insert_calendar(conn)
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


def _require_int(body: dict, key: str) -> int:
    value = _require_present(body, key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise LedgerError(400, f"{key} は整数である必要があります")
    return value


def _require_positive_int(body: dict, key: str) -> int:
    value = _require_present(body, key)
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise LedgerError(400, f"{key} は 1 以上の整数である必要があります")
    return value


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


def add_member(path: Path, body: object) -> dict:
    payload = _require_object(body)
    name = _require_text(payload, "name")
    if len(name) > 12:
        raise LedgerError(400, "name は 12 文字以内である必要があります")
    conn = connect(path)
    try:
        with _immediate(conn):
            conn.execute("INSERT INTO members (name) VALUES (?) ON CONFLICT(name) DO NOTHING", (name,))
        return {"members": _member_names(conn)}
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
