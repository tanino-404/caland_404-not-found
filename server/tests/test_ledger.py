"""家計簿サーバーの unittest。一時 DB だけを使う。"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app
import db
import seed

JS_SAMPLE_SHA256 = "d54bf63d3adca37a8835e946f51b92bf99b4110213bd89b9347903498307e62d"
# サンプル家計を DB に入れるときの「今日」。これより後の記帳は DB に入らない。
TODAY = "2026-11-03"
TARO = "たろう"
HANA = "はなこ"


def savings(entries: list[dict], member: str, year_month: str) -> int:
    """そのメンバーの月の貯金。owners に member を含む記帳を金額そのままで数える。"""
    income = 0
    expense = 0
    prefix = f"{year_month}-"
    for entry in entries:
        if member not in entry["owners"] or not str(entry["date"]).startswith(prefix):
            continue
        if entry["kind"] == "income":
            income += entry["amount"]
        else:
            expense += entry["amount"]
    return income - expense


def canonical_sample_hash(entries: list[dict]) -> str:
    blob = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def seeded_entries() -> list[dict]:
    """DB に入るサンプル記帳。TODAY より後は除く。"""
    entries, _ = seed.build_sample()
    return [entry for entry in entries if entry["date"] <= TODAY]


class LedgerApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "ledger.sqlite"
        db.TODAY_OVERRIDE = TODAY
        self.addCleanup(setattr, db, "TODAY_OVERRIDE", None)
        self.httpd: app.LedgerHTTPServer | None = None
        self.thread: threading.Thread | None = None
        self.base = ""

    def tearDown(self) -> None:
        self.stop()

    def start(self, path: Path | None = None) -> None:
        self.stop()
        target = self.db_path if path is None else path
        self.httpd = app.serve(target, "127.0.0.1", 0)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.httpd.server_address
        self.base = f"http://{host}:{port}"
        self._wait_until_listening()

    def stop(self) -> None:
        httpd = self.httpd
        thread = self.thread
        self.httpd = None
        self.thread = None
        if httpd is not None:
            httpd.shutdown()
            httpd.server_close()
        if thread is not None:
            thread.join(timeout=5)
            if thread.is_alive():
                raise RuntimeError("テスト用サーバーが停止しませんでした")

    def _wait_until_listening(self) -> None:
        deadline = time.time() + 2
        while True:
            try:
                status, body = self.request("GET", "/api/health")
            except urllib.error.URLError as exc:
                if time.time() >= deadline:
                    raise
                if isinstance(exc.reason, (ConnectionRefusedError, TimeoutError)):
                    time.sleep(0.01)
                    continue
                raise
            if status == 200 and body == {"ok": True}:
                return
            if time.time() >= deadline:
                raise RuntimeError(f"health が返りません: {status} {body}")
            time.sleep(0.01)

    def request(self, method: str, path: str, body: object | None = None) -> tuple[int, object]:
        data = None
        headers: dict[str, str] = {}
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                raw = res.read()
                parsed = json.loads(raw.decode("utf-8")) if raw else None
                return res.status, parsed
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            parsed = json.loads(raw.decode("utf-8")) if raw else None
            return exc.code, parsed

    def test_sample_matches_javascript_seed(self) -> None:
        entries, goals = seed.build_sample()
        self.assertEqual(JS_SAMPLE_SHA256, canonical_sample_hash(entries))
        self.assertEqual(870, len(entries))
        every_month = {
            f"{year}-{month:02d}": 30_000 for year in (2025, 2026, 2027) for month in range(1, 13)
        }
        self.assertEqual({TARO: every_month, HANA: every_month}, goals)
        self.assertEqual({1}, {len(entry["owners"]) for entry in entries})
        self.assertGreaterEqual(savings(entries, TARO, "2026-03"), 30_000)
        self.assertLess(savings(entries, TARO, "2026-08"), 30_000)
        self.assertEqual(66_000, savings(entries, TARO, "2026-03"))
        self.assertEqual(-26_400, savings(entries, TARO, "2026-08"))
        self.assertEqual(63_000, savings(entries, HANA, "2026-03"))
        self.assertEqual(-25_200, savings(entries, HANA, "2026-08"))
        for member in (TARO, HANA):
            luxurious = [
                month
                for month in range(1, 13)
                if savings(entries, member, f"2026-{month:02d}") >= 30_000
            ]
            self.assertEqual([1, 3, 4, 7, 11, 12], luxurious)
        self.assertEqual(
            {
                "id": "ledger-sample-2025-0",
                "date": "2025-01-25",
                "kind": "income",
                "amount": 220_000,
                "title": "給与",
                "owners": ["たろう"],
            },
            entries[0],
        )
        self.assertEqual([TARO], entries[1]["owners"])
        self.assertEqual("家賃", entries[1]["title"])
        self.assertEqual(42_500, entries[1]["amount"])
        self.assertEqual([HANA], entries[12]["owners"])
        self.assertEqual("給与", entries[12]["title"])
        self.assertEqual(210_000, entries[12]["amount"])
        self.assertEqual("ledger-sample-2026-0", entries[290]["id"])
        self.assertEqual("2026-01-25", entries[290]["date"])
        self.assertEqual("ledger-sample-2027-0", entries[580]["id"])

    def test_empty_db_is_seeded_on_startup(self) -> None:
        self.assertFalse(self.db_path.exists())
        self.start()
        status, payload = self.request("GET", "/api/ledger")
        self.assertEqual(200, status)
        assert isinstance(payload, dict)
        entries = seeded_entries()
        _, goals = seed.build_sample()
        self.assertEqual(entries, payload["entries"])
        self.assertEqual(goals, payload["goals"])
        self.assertTrue(all(entry["date"] <= TODAY for entry in payload["entries"]))
        for member in (TARO, HANA):
            luxurious = [
                f"{year}-{month:02d}"
                for year in (2025, 2026, 2027)
                for month in range(1, 13)
                if savings(payload["entries"], member, f"{year}-{month:02d}")
                >= payload["goals"][member][f"{year}-{month:02d}"]
            ]
            self.assertEqual(
                [
                    "2025-01", "2025-03", "2025-04", "2025-07", "2025-11", "2025-12",
                    "2026-01", "2026-03", "2026-04", "2026-07",
                ],
                luxurious,
            )

        self.stop()
        db.ensure_ready(self.db_path)
        again = db.fetch_ledger(self.db_path)
        self.assertEqual(entries, again["entries"])

    def test_empty_tables_are_seeded_on_startup(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = db.connect(self.db_path)
        try:
            conn.executescript(db.SCHEMA)
            conn.commit()
        finally:
            conn.close()
        self.start()
        status, payload = self.request("GET", "/api/ledger")
        self.assertEqual(200, status)
        assert isinstance(payload, dict)
        _, goals = seed.build_sample()
        self.assertEqual(seeded_entries(), payload["entries"])
        self.assertEqual(goals, payload["goals"])

    def test_add_forbid_other_user_update_goal_and_reset(self) -> None:
        self.start()
        status, created = self.request(
            "POST",
            "/api/ledger",
            {
                "date": "2026-03-15",
                "kind": "expense",
                "amount": 1234,
                "title": "テスト支出",
                "owner": "たろう",
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        self.assertRegex(created["id"], r"^ledger-\d+-\d+$")
        self.assertEqual(["たろう"], created["owners"])
        self.assertEqual(1234, created["amount"])
        self.assertEqual("テスト支出", created["title"])
        self.assertEqual("expense", created["kind"])
        self.assertEqual("2026-03-15", created["date"])

        status, denied = self.request(
            "DELETE",
            f"/api/ledger/{quote(created['id'], safe='')}?user={quote('はなこ')}",
        )
        self.assertEqual(403, status)
        self.assertEqual({"error": '"はなこ" の記帳ではありません: テスト支出'}, denied)

        status, current = self.request("GET", "/api/ledger")
        self.assertEqual(200, status)
        assert isinstance(current, dict)
        self.assertIn(created["id"], [entry["id"] for entry in current["entries"]])

        status, missing = self.request("DELETE", "/api/ledger/missing-id?user=" + quote("たろう"))
        self.assertEqual(404, status)
        self.assertEqual({"error": "記帳が見つかりません: missing-id"}, missing)

        status, removed = self.request(
            "DELETE",
            f"/api/ledger/{quote(created['id'], safe='')}?user={quote('たろう')}",
        )
        self.assertEqual(204, status)
        self.assertIsNone(removed)

        status, after_delete = self.request("GET", "/api/ledger")
        assert isinstance(after_delete, dict)
        self.assertNotIn(created["id"], [entry["id"] for entry in after_delete["entries"]])

        status, created = self.request(
            "POST",
            "/api/ledger",
            {
                "date": "2026-08-02",
                "kind": "income",
                "amount": 500,
                "title": "臨時",
                "owner": "はなこ",
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)

        status, goal = self.request(
            "PUT",
            "/api/goals",
            {"owner": HANA, "year": 2026, "month": 8, "amount": 99999},
        )
        self.assertEqual(200, status)
        self.assertEqual({"owner": HANA, "yearMonth": "2026-08", "amount": 99999}, goal)

        status, stranger = self.request(
            "PUT",
            "/api/goals",
            {"owner": "ななし", "year": 2026, "month": 8, "amount": 1000},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": '"ななし" はメンバーではありません'}, stranger)

        status, no_owner = self.request(
            "PUT",
            "/api/goals",
            {"year": 2026, "month": 8, "amount": 1000},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "owner がありません"}, no_owner)

        status, listed = self.request("GET", "/api/ledger")
        assert isinstance(listed, dict)
        self.assertEqual(99999, listed["goals"][HANA]["2026-08"])
        self.assertEqual(30_000, listed["goals"][TARO]["2026-08"])
        self.assertNotIn("ななし", listed["goals"])
        self.assertIn(created["id"], [entry["id"] for entry in listed["entries"]])

        status, reset = self.request("POST", "/api/ledger/reset")
        self.assertEqual(200, status)
        _, goals = seed.build_sample()
        self.assertEqual({"entries": seeded_entries(), "goals": goals}, reset)
        assert isinstance(reset, dict)
        self.assertNotIn(created["id"], [entry["id"] for entry in reset["entries"]])
        self.assertEqual(30_000, reset["goals"][HANA]["2026-08"])
        self.assertGreaterEqual(savings(reset["entries"], TARO, "2026-03"), 30_000)
        self.assertLess(savings(reset["entries"], TARO, "2026-08"), 30_000)
        self.assertLess(savings(reset["entries"], TARO, "2026-11"), 30_000)

    def test_restart_keeps_rows(self) -> None:
        self.start()
        status, created = self.request(
            "POST",
            "/api/ledger",
            {
                "date": "2026-04-04",
                "kind": "expense",
                "amount": 800,
                "title": "残す",
                "owner": "たろう",
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        self.stop()
        self.start()
        status, payload = self.request("GET", "/api/ledger")
        self.assertEqual(200, status)
        assert isinstance(payload, dict)
        self.assertEqual(len(seeded_entries()) + 1, len(payload["entries"]))
        self.assertIn(created["id"], [entry["id"] for entry in payload["entries"]])

    def test_invalid_json_returns_parser_message(self) -> None:
        self.start()
        try:
            json.loads("{")
        except json.JSONDecodeError as exc:
            expected = str(exc)
        req = urllib.request.Request(
            self.base + "/api/ledger",
            data=b"{",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(req, timeout=5)
        body = json.loads(caught.exception.read().decode("utf-8"))
        self.assertEqual(400, caught.exception.code)
        self.assertEqual({"error": expected}, body)

    def test_reject_bad_amount_and_unknown_path(self) -> None:
        self.start()
        status, before = self.request("GET", "/api/ledger")
        self.assertEqual(200, status)
        status, rejected = self.request(
            "POST",
            "/api/ledger",
            {
                "date": "2026-03-15",
                "kind": "expense",
                "amount": 0,
                "title": "ゼロ",
                "owner": "たろう",
            },
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "amount は 1 以上の整数である必要があります"}, rejected)
        status, after = self.request("GET", "/api/ledger")
        self.assertEqual(before, after)

        status, unknown = self.request("GET", "/api/nope")
        self.assertEqual(404, status)
        self.assertEqual({"error": "not found: /api/nope"}, unknown)

        status, health = self.request("GET", "/api/health")
        self.assertEqual(200, status)
        self.assertEqual({"ok": True}, health)


if __name__ == "__main__":
    unittest.main()
