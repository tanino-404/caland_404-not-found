"""管理プラグインサーバーの unittest。同梱の ledger プラグインで一時 DB だけを使う。"""

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
import plugin_store
import seed

JS_SAMPLE_SHA256 = "5fb31f489f318adb85c32e800bfb6bf08b0a1a0f78a0c98efb91184db86bf8b3"


def to_plugin_entry(entry: dict) -> dict:
    """seed.build_sample の 1 件を sample.json（プラグイン形式）に揃える。"""
    return {
        "id": entry["id"],
        "date": entry["date"],
        "owners": entry["owners"],
        "values": {"kind": entry["kind"], "amount": entry["amount"], "title": entry["title"]},
    }


def savings(entries: list[dict], year_month: str) -> int:
    income = 0
    expense = 0
    prefix = f"{year_month}-"
    for entry in entries:
        if not str(entry["date"]).startswith(prefix):
            continue
        if entry["values"]["kind"] == "income":
            income += entry["values"]["amount"]
        else:
            expense += entry["values"]["amount"]
    return income - expense


def canonical_sample_hash(entries: list[dict]) -> str:
    blob = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class LedgerPluginApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "ledger.sqlite"
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

    def fetch_ledger_plugin(self) -> dict:
        status, payload = self.request("GET", "/api/plugins")
        self.assertEqual(200, status)
        assert isinstance(payload, dict)
        plugins = payload["plugins"]
        ledger = [plugin for plugin in plugins if plugin["manifest"]["id"] == "ledger"]
        self.assertEqual(1, len(ledger))
        return ledger[0]

    def test_sample_matches_javascript_seed_and_sample_json(self) -> None:
        entries, goals = seed.build_sample()
        self.assertEqual(JS_SAMPLE_SHA256, canonical_sample_hash(entries))
        self.assertEqual(158, len(entries))
        self.assertEqual({f"2026-{month:02d}": 50_000 for month in range(1, 13)}, goals)

        sample_path = plugin_store.PLUGINS_DIR / "ledger" / "sample.json"
        sample = json.loads(sample_path.read_text("utf-8"))
        self.assertEqual([to_plugin_entry(entry) for entry in entries], sample["entries"])
        self.assertEqual(goals, sample["goals"])
        self.assertGreaterEqual(savings(sample["entries"], "2026-03"), 50_000)
        self.assertLess(savings(sample["entries"], "2026-08"), 50_000)
        self.assertEqual(129_000, savings(sample["entries"], "2026-03"))
        self.assertEqual(-51_600, savings(sample["entries"], "2026-08"))
        self.assertEqual(
            {
                "id": "ledger-sample-0",
                "date": "2026-01-25",
                "owners": ["たろう"],
                "values": {"kind": "income", "amount": 220_000, "title": "給与"},
            },
            sample["entries"][0],
        )
        self.assertEqual(["たろう", "はなこ"], sample["entries"][2]["owners"])
        self.assertEqual("家賃", sample["entries"][2]["values"]["title"])

    def test_manifest_formula_progress_and_achievement(self) -> None:
        manifest = plugin_store.get_manifest("ledger")
        self.assertEqual("luxury", manifest["effect"])
        entries, goals = seed.build_sample()
        plugin_entries = [to_plugin_entry(entry) for entry in entries]
        march = plugin_store.period_progress(manifest, plugin_entries, "2026-03")
        august = plugin_store.period_progress(manifest, plugin_entries, "2026-08")
        self.assertEqual(129_000, march)
        self.assertEqual(-51_600, august)
        goal = plugin_store.period_goal(manifest, goals, "2026-03")
        self.assertEqual(50_000, goal)
        self.assertTrue(plugin_store.is_achieved(manifest, march, goal))
        self.assertFalse(plugin_store.is_achieved(manifest, august, goal))
        self.assertFalse(plugin_store.is_achieved(manifest, march, None))

    def test_bad_formula_is_rejected(self) -> None:
        manifest = plugin_store.get_manifest("ledger")
        fields = {field["id"]: field for field in manifest["fields"]}
        with self.assertRaises(ValueError) as caught:
            plugin_store.parse_formula("ledger", "sum:amount * 2", fields)
        self.assertIn("*", str(caught.exception))
        with self.assertRaises(ValueError):
            plugin_store.parse_formula("ledger", "sum:nope", fields)
        with self.assertRaises(ValueError):
            plugin_store.parse_formula("ledger", "sum_if:kind:bonus:amount", fields)
        with self.assertRaises(ValueError):
            plugin_store.parse_formula("ledger", "sum:amount -", fields)

    def test_empty_db_is_seeded_on_startup(self) -> None:
        self.assertFalse(self.db_path.exists())
        self.start()
        plugin = self.fetch_ledger_plugin()
        entries, goals = seed.build_sample()
        expected = [to_plugin_entry(entry) for entry in entries]
        self.assertEqual(expected, plugin["entries"])
        self.assertEqual(goals, plugin["goals"])
        self.assertGreaterEqual(savings(plugin["entries"], "2026-03"), 50_000)
        self.assertLess(savings(plugin["entries"], "2026-08"), 50_000)

        self.stop()
        db.ensure_ready(self.db_path)
        plugin_store.ensure_ready(self.db_path)
        again = plugin_store.fetch_plugins(self.db_path)
        self.assertEqual(expected, again["plugins"][0]["entries"])

    def test_empty_tables_are_seeded_on_startup(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = db.connect(self.db_path)
        try:
            conn.executescript(db.SCHEMA)
            conn.commit()
        finally:
            conn.close()
        self.start()
        plugin = self.fetch_ledger_plugin()
        entries, goals = seed.build_sample()
        self.assertEqual([to_plugin_entry(entry) for entry in entries], plugin["entries"])
        self.assertEqual(goals, plugin["goals"])

    def test_legacy_ledger_tables_are_migrated(self) -> None:
        """旧 ledger_entries / monthly_goals の中身が ledger プラグインへ移る。"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = db.connect(self.db_path)
        try:
            conn.executescript(db.SCHEMA)
            conn.executescript(
                """
                CREATE TABLE ledger_entries (
                  id TEXT PRIMARY KEY, date TEXT NOT NULL, kind TEXT NOT NULL,
                  amount INTEGER NOT NULL, title TEXT NOT NULL, owners_json TEXT NOT NULL
                );
                CREATE TABLE monthly_goals (year_month TEXT PRIMARY KEY, amount INTEGER NOT NULL);
                """
            )
            conn.execute(
                "INSERT INTO ledger_entries VALUES ('old-1', '2026-05-05', 'expense', 700, '引き継ぐ', ?)",
                (json.dumps(["たろう"], ensure_ascii=False),),
            )
            conn.execute("INSERT INTO monthly_goals VALUES ('2026-05', 12345)")
            conn.commit()
        finally:
            conn.close()
        self.start()
        plugin = self.fetch_ledger_plugin()
        self.assertEqual(
            [
                {
                    "id": "old-1",
                    "date": "2026-05-05",
                    "owners": ["たろう"],
                    "values": {"kind": "expense", "amount": 700, "title": "引き継ぐ"},
                }
            ],
            plugin["entries"],
        )
        self.assertEqual({"2026-05": 12345}, plugin["goals"])

    def test_add_forbid_other_user_update_goal_and_reset(self) -> None:
        self.start()
        status, created = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-03-15",
                "owner": "たろう",
                "values": {"kind": "expense", "amount": 1234, "title": "テスト支出"},
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        self.assertRegex(created["id"], r"^ledger-\d+-\d+$")
        self.assertEqual(["たろう"], created["owners"])
        self.assertEqual(
            {"kind": "expense", "amount": 1234, "title": "テスト支出"}, created["values"]
        )
        self.assertEqual("2026-03-15", created["date"])

        status, denied = self.request(
            "DELETE",
            f"/api/plugins/ledger/entries/{quote(created['id'], safe='')}?user={quote('はなこ')}",
        )
        self.assertEqual(403, status)
        self.assertEqual({"error": '"はなこ" の記帳ではありません: テスト支出'}, denied)

        plugin = self.fetch_ledger_plugin()
        self.assertIn(created["id"], [entry["id"] for entry in plugin["entries"]])

        status, missing = self.request(
            "DELETE", "/api/plugins/ledger/entries/missing-id?user=" + quote("たろう")
        )
        self.assertEqual(404, status)
        self.assertEqual({"error": "記帳が見つかりません: missing-id"}, missing)

        status, removed = self.request(
            "DELETE",
            f"/api/plugins/ledger/entries/{quote(created['id'], safe='')}?user={quote('たろう')}",
        )
        self.assertEqual(204, status)
        self.assertIsNone(removed)

        plugin = self.fetch_ledger_plugin()
        self.assertNotIn(created["id"], [entry["id"] for entry in plugin["entries"]])

        status, created = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-08-02",
                "owner": "はなこ",
                "values": {"kind": "income", "amount": 500, "title": "臨時"},
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)

        status, goal = self.request(
            "PUT",
            "/api/plugins/ledger/goals",
            {"year": 2026, "month": 8, "amount": 99999},
        )
        self.assertEqual(200, status)
        self.assertEqual({"plugin": "ledger", "yearMonth": "2026-08", "amount": 99999}, goal)

        plugin = self.fetch_ledger_plugin()
        self.assertEqual(99999, plugin["goals"]["2026-08"])
        self.assertIn(created["id"], [entry["id"] for entry in plugin["entries"]])

        status, reset = self.request("POST", "/api/reset")
        self.assertEqual(200, status)
        assert isinstance(reset, dict)
        entries, goals = seed.build_sample()
        expected = [to_plugin_entry(entry) for entry in entries]
        ledger = [plugin for plugin in reset["plugins"] if plugin["manifest"]["id"] == "ledger"][0]
        self.assertEqual(expected, ledger["entries"])
        self.assertEqual(goals, ledger["goals"])
        self.assertNotIn(created["id"], [entry["id"] for entry in ledger["entries"]])
        self.assertEqual(50_000, ledger["goals"]["2026-08"])
        self.assertEqual(["たろう", "はなこ"], reset["members"])
        self.assertGreater(len(reset["events"]), 0)

    def test_restart_keeps_rows(self) -> None:
        self.start()
        status, created = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-04-04",
                "owner": "たろう",
                "values": {"kind": "expense", "amount": 800, "title": "残す"},
            },
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        self.stop()
        self.start()
        plugin = self.fetch_ledger_plugin()
        self.assertEqual(159, len(plugin["entries"]))
        self.assertIn(created["id"], [entry["id"] for entry in plugin["entries"]])

    def test_invalid_json_returns_parser_message(self) -> None:
        self.start()
        try:
            json.loads("{")
        except json.JSONDecodeError as exc:
            expected = str(exc)
        req = urllib.request.Request(
            self.base + "/api/plugins/ledger/entries",
            data=b"{",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(req, timeout=5)
        body = json.loads(caught.exception.read().decode("utf-8"))
        self.assertEqual(400, caught.exception.code)
        self.assertEqual({"error": expected}, body)

    def test_reject_bad_values_and_unknown_paths(self) -> None:
        self.start()
        before = self.fetch_ledger_plugin()
        status, rejected = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-03-15",
                "owner": "たろう",
                "values": {"kind": "expense", "amount": 0, "title": "ゼロ"},
            },
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "values.amount は 1 以上である必要があります"}, rejected)

        status, bad_choice = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-03-15",
                "owner": "たろう",
                "values": {"kind": "loan", "amount": 100, "title": "不正"},
            },
        )
        self.assertEqual(400, status)
        self.assertEqual(
            {"error": "values.kind は ['income', 'expense'] のどれかである必要があります"}, bad_choice
        )

        status, extra = self.request(
            "POST",
            "/api/plugins/ledger/entries",
            {
                "date": "2026-03-15",
                "owner": "たろう",
                "values": {"kind": "expense", "amount": 100, "title": "余分", "memo": "x"},
            },
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "values に未定義のフィールドがあります: ['memo']"}, extra)

        after = self.fetch_ledger_plugin()
        self.assertEqual(before, after)

        status, unknown_plugin = self.request(
            "POST",
            "/api/plugins/nope/entries",
            {"date": "2026-03-15", "owner": "たろう", "values": {}},
        )
        self.assertEqual(404, status)
        self.assertEqual({"error": "プラグインが見つかりません: nope"}, unknown_plugin)

        status, no_inbound = self.request("POST", "/api/plugins/ledger/inbound", {"x": 1})
        self.assertEqual(404, status)
        self.assertEqual({"error": "プラグイン ledger は inbound を受け付けません"}, no_inbound)

        status, unknown = self.request("GET", "/api/nope")
        self.assertEqual(404, status)
        self.assertEqual({"error": "not found: /api/nope"}, unknown)

        status, gone = self.request("GET", "/api/ledger")
        self.assertEqual(404, status)
        self.assertEqual({"error": "not found: /api/ledger"}, gone)

        status, health = self.request("GET", "/api/health")
        self.assertEqual(200, status)
        self.assertEqual({"ok": True}, health)


if __name__ == "__main__":
    unittest.main()
