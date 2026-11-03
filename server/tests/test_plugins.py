"""管理内容プラグインの unittest。移し替えた家計簿データでサンドボックスを検証する。一時 DB だけを使う。"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app
import db
import new_plugin
import plugins
import seed

JS_SAMPLE_SHA256 = "d54bf63d3adca37a8835e946f51b92bf99b4110213bd89b9347903498307e62d"
# サンプル家計を DB に入れるときの「今日」。これより後の記帳は DB に入らない。
TODAY = "2026-11-03"
TARO = "たろう"
HANA = "はなこ"

OLD_SCHEMA = """
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  title TEXT NOT NULL,
  owners_json TEXT NOT NULL
);
CREATE TABLE monthly_goals (
  year_month TEXT PRIMARY KEY,
  amount INTEGER NOT NULL
);
CREATE TABLE members (name TEXT PRIMARY KEY);
"""

PRACTICE_MANIFEST = {
    "schemaVersion": 1,
    "id": "practice",
    "name": "練習",
    "version": "0.1.0",
    "fields": [
        {"key": "minutes", "type": "integer", "label": "分", "min": 1, "required": True},
        {"key": "memo", "type": "text", "label": "メモ"},
    ],
    "metrics": [{"key": "total", "label": "合計", "agg": "sum", "field": "minutes", "unit": "分"}],
    "goal": {"metric": "total", "op": ">="},
    "effects": [{"id": "plain", "minProgress": 0, "theme": "plain"}, {"id": "luxury", "minProgress": 1, "theme": "luxury"}],
    "integrations": [
        {
            "id": "created",
            "direction": "outgoing",
            "on": "entry.created",
            "adapter": "json",
            "urlEnv": "TEST_HOOK_URL",
        },
        {
            "id": "achieved",
            "direction": "outgoing",
            "on": "goal.achieved",
            "adapter": "discord",
            "urlEnv": "TEST_HOOK_URL",
            "template": "{pluginName} 達成 {value}/{target} ({progress}%)",
        },
        {
            "id": "importer",
            "direction": "incoming",
            "map": {"minutes": "payload.min", "memo": "payload.note"},
            "dateFrom": "payload.date",
            "tokenEnv": "TEST_HOOK_TOKEN",
        },
    ],
}


def seed_as_plugin_entries(member: str, group_id: str) -> list[dict]:
    """member の家計簿グループに入るサンプル記帳。TODAY より後は除く。"""
    entries, _ = seed.build_sample()
    return [
        {
            "id": entry["id"],
            "pluginId": "ledger",
            "groupId": group_id,
            "date": entry["date"],
            "data": {"kind": entry["kind"], "amount": entry["amount"], "title": entry["title"]},
            "owners": entry["owners"],
        }
        for entry in entries
        if entry["owners"] == [member] and entry["date"] <= TODAY
    ]


def canonical_sample_hash(entries: list[dict]) -> str:
    blob = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class PluginApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "ledger.sqlite"
        db.TODAY_OVERRIDE = TODAY
        self.addCleanup(setattr, db, "TODAY_OVERRIDE", None)
        self.plugins_dir = app.PLUGINS_DIR
        self.httpd: app.LedgerHTTPServer | None = None
        self.thread: threading.Thread | None = None
        self.base = ""

    def tearDown(self) -> None:
        self.stop()

    def start(self) -> None:
        self.stop()
        self.httpd = app.serve(self.db_path, "127.0.0.1", 0, self.plugins_dir)
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

    def request(
        self, method: str, path: str, body: object | None = None, headers: dict[str, str] | None = None
    ) -> tuple[int, object]:
        data = None
        all_headers: dict[str, str] = dict(headers or {})
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            all_headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data, headers=all_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                raw = res.read()
                parsed = json.loads(raw.decode("utf-8")) if raw else None
                return res.status, parsed
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            parsed = json.loads(raw.decode("utf-8")) if raw else None
            return exc.code, parsed

    def ledger_group(self, member: str = TARO) -> str:
        """家計簿はメンバーごとに 1 グループ。member だけのグループの id"""
        status, body = self.request("GET", "/api/plugins/ledger/groups")
        self.assertEqual(200, status)
        assert isinstance(body, dict)
        mine = [g["id"] for g in body["groups"] if g["members"] == [member]]
        self.assertEqual(1, len(mine))
        return mine[0]

    # ---------- シードと移し替え ----------

    def test_sample_matches_javascript_seed(self) -> None:
        entries, goals = seed.build_sample()
        self.assertEqual(JS_SAMPLE_SHA256, canonical_sample_hash(entries))
        self.assertEqual(870, len(entries))
        every_month = {f"{year}-{month:02d}": 30_000 for year in (2025, 2026, 2027) for month in range(1, 13)}
        self.assertEqual({TARO: every_month, HANA: every_month}, goals)
        self.assertEqual({1}, {len(entry["owners"]) for entry in entries})

    def test_empty_db_seeds_ledger_plugin(self) -> None:
        self.assertFalse(self.db_path.exists())
        self.start()

        status, listed = self.request("GET", "/api/plugins")
        self.assertEqual(200, status)
        assert isinstance(listed, dict)
        self.assertIn("ledger", [m["id"] for m in listed["plugins"]])

        status, groups = self.request("GET", "/api/plugins/ledger/groups")
        self.assertEqual(200, status)
        assert isinstance(groups, dict)
        self.assertEqual(
            [
                {"id": "ledger-member-1", "pluginId": "ledger", "name": "たろうの家計簿", "members": [TARO]},
                {"id": "ledger-member-2", "pluginId": "ledger", "name": "はなこの家計簿", "members": [HANA]},
            ],
            groups["groups"],
        )

        for member, group in ((TARO, "ledger-member-1"), (HANA, "ledger-member-2")):
            status, body = self.request("GET", f"/api/plugins/ledger/groups/{group}/entries")
            self.assertEqual(200, status)
            assert isinstance(body, dict)
            self.assertEqual(seed_as_plugin_entries(member, group), body["entries"])

        status, goals = self.request("GET", "/api/plugins/ledger/groups/ledger-member-1/goals")
        self.assertEqual(200, status)
        assert isinstance(goals, dict)
        self.assertEqual(36, len(goals["goals"]))
        march = next(g for g in goals["goals"] if g["start"] == "2026-03-01")
        self.assertEqual({"metric": "savings", "end": "2026-03-31", "target": 30_000},
                         {k: march[k] for k in ("metric", "end", "target")})

        status, st = self.request("GET", "/api/plugins/ledger/groups/ledger-member-1/status?at=2026-03-31")
        self.assertEqual(200, status)
        assert isinstance(st, dict)
        self.assertEqual((66_000, True, 1.0, "luxury", True),
                         (st["value"], st["achieved"], st["progress"], st["effect"], st["finished"]))

        status, st = self.request("GET", "/api/plugins/ledger/groups/ledger-member-1/status?at=2026-08-31")
        assert isinstance(st, dict)
        self.assertEqual((-26_400, False, 0.0, "plain"),
                         (st["value"], st["achieved"], st["progress"], st["effect"]))

        # 今日より後の記帳は入らないので、先の月は達成しない
        status, st = self.request("GET", "/api/plugins/ledger/groups/ledger-member-1/status?at=2026-12-31")
        assert isinstance(st, dict)
        self.assertFalse(st["achieved"])

    def test_old_db_is_migrated_to_plugin_tables(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        try:
            conn.executescript(OLD_SCHEMA)
            conn.execute("INSERT INTO members (name) VALUES ('ぎんこう')")
            conn.execute(
                "INSERT INTO ledger_entries VALUES ('ledger-1', '2026-02-03', 'income', 1000, '古い収入', '[\"ぎんこう\"]')"
            )
            conn.execute(
                "INSERT INTO ledger_entries VALUES ('ledger-2', '2026-02-10', 'expense', 300, '古い支出', '[\"ぎんこう\"]')"
            )
            conn.execute("INSERT INTO monthly_goals VALUES ('2026-02', 500)")
            conn.commit()
        finally:
            conn.close()

        db.ensure_ready(self.db_path, self.plugins_dir)
        self.start()

        group = self.ledger_group("ぎんこう")
        status, body = self.request("GET", f"/api/plugins/ledger/groups/{group}/entries")
        assert isinstance(body, dict)
        self.assertEqual(
            [
                {"id": "ledger-1", "pluginId": "ledger", "groupId": group, "date": "2026-02-03",
                 "data": {"kind": "income", "amount": 1000, "title": "古い収入"}, "owners": ["ぎんこう"]},
                {"id": "ledger-2", "pluginId": "ledger", "groupId": group, "date": "2026-02-10",
                 "data": {"kind": "expense", "amount": 300, "title": "古い支出"}, "owners": ["ぎんこう"]},
            ],
            body["entries"],
        )

        status, st = self.request("GET", f"/api/plugins/ledger/groups/{group}/status?at=2026-02-28")
        assert isinstance(st, dict)
        self.assertEqual((700, True, "luxury"), (st["value"], st["achieved"], st["effect"]))

        conn = sqlite3.connect(self.db_path)
        try:
            names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        finally:
            conn.close()
        self.assertNotIn("ledger_entries", names)
        self.assertNotIn("monthly_goals", names)

        # 再起動してもサンプルで上書きされない
        self.stop()
        db.ensure_ready(self.db_path, self.plugins_dir)
        self.start()
        status, again = self.request("GET", f"/api/plugins/ledger/groups/{group}/entries")
        assert isinstance(again, dict)
        self.assertEqual(2, len(again["entries"]))

    # ---------- 記録と権限 ----------

    def test_entry_validation_and_permissions(self) -> None:
        self.start()
        group = self.ledger_group()
        base = f"/api/plugins/ledger/groups/{group}"

        status, created = self.request(
            "POST", f"{base}/entries",
            {"date": "2026-03-15", "owner": "たろう", "data": {"kind": "expense", "amount": 1234, "title": "テスト支出"}},
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        self.assertRegex(created["id"], r"^ledger-\d+-\d+$")
        self.assertEqual({"kind": "expense", "amount": 1234, "title": "テスト支出"}, created["data"])
        self.assertEqual(["たろう"], created["owners"])

        status, rejected = self.request(
            "POST", f"{base}/entries",
            {"date": "2026-03-15", "owner": "たろう", "data": {"kind": "expense", "amount": 0, "title": "ゼロ"}},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "amount は 1 以上の整数である必要があります"}, rejected)

        status, rejected = self.request(
            "POST", f"{base}/entries",
            {"date": "2026-03-15", "owner": "たろう", "data": {"kind": "引き出し", "amount": 1, "title": "x"}},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "kind は income または expense である必要があります"}, rejected)

        status, rejected = self.request(
            "POST", f"{base}/entries",
            {"date": "2026-03-15", "owner": "たろう", "data": {"kind": "income", "amount": 1, "title": "x", "nazo": 1}},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "定義されていない項目です: nazo"}, rejected)

        status, rejected = self.request(
            "POST", f"{base}/entries",
            {"date": "2026-03-15", "owner": "よそもの", "data": {"kind": "income", "amount": 1, "title": "x"}},
        )
        self.assertEqual(403, status)
        self.assertEqual({"error": '"よそもの" はこのグループのメンバーではありません'}, rejected)

        entry_path = f"{base}/entries/{quote(created['id'], safe='')}"
        status, denied = self.request("DELETE", f"{entry_path}?user={quote('はなこ')}")
        self.assertEqual(403, status)
        self.assertEqual({"error": '"はなこ" の記録ではありません: テスト支出'}, denied)

        status, removed = self.request("DELETE", f"{entry_path}?user={quote('たろう')}")
        self.assertEqual(204, status)
        self.assertIsNone(removed)

        status, missing = self.request("DELETE", f"{base}/entries/missing-id?user={quote('たろう')}")
        self.assertEqual(404, status)
        self.assertEqual({"error": "記録が見つかりません: missing-id"}, missing)

    # ---------- 任意期間の目標 ----------

    def test_goals_any_period_and_latest_wins(self) -> None:
        self.start()
        status, group = self.request(
            "POST", "/api/plugins/ledger/groups", {"name": "テスト部", "members": ["たろう"]}
        )
        self.assertEqual(201, status)
        assert isinstance(group, dict)
        base = f"/api/plugins/ledger/groups/{group['id']}"

        for date, amount in (("2026-03-05", 100), ("2026-03-18", 70)):
            status, _ = self.request(
                "POST", f"{base}/entries",
                {"date": date, "owner": "たろう", "data": {"kind": "income", "amount": amount, "title": "小遣い"}},
            )
            self.assertEqual(201, status)

        status, first = self.request(
            "POST", f"{base}/goals",
            {"user": "たろう", "start": "2026-03-01", "end": "2026-03-10", "target": 100, "label": "前半テスト"},
        )
        self.assertEqual(201, status)
        status, _ = self.request(
            "POST", f"{base}/goals",
            {"user": "たろう", "start": "2026-03-15", "end": "2026-03-25", "target": 200, "label": "後半テスト"},
        )
        self.assertEqual(201, status)

        # 前半が終わった直後は前半の結果（達成）を見せる
        status, st = self.request("GET", f"{base}/status?at=2026-03-12")
        assert isinstance(st, dict)
        self.assertEqual(("前半テスト", 100, True, True, "luxury"),
                         (st["goal"]["label"], st["value"], st["achieved"], st["finished"], st["effect"]))

        # 後半の期間中はそちら。70/200 で未達
        status, st = self.request("GET", f"{base}/status?at=2026-03-20")
        assert isinstance(st, dict)
        self.assertEqual("後半テスト", st["goal"]["label"])
        self.assertEqual(70, st["value"])
        self.assertFalse(st["achieved"])
        self.assertAlmostEqual(0.35, st["progress"])

        # 月末を過ぎたら、直前に終わった後半の結果が残る
        status, st = self.request("GET", f"{base}/status?at=2026-03-31")
        assert isinstance(st, dict)
        self.assertEqual("後半テスト", st["goal"]["label"])
        self.assertTrue(st["finished"])

        # 同じ期間をもう一度登録すると後から作った方が勝つ（上書き）
        status, _ = self.request(
            "POST", f"{base}/goals",
            {"user": "たろう", "start": "2026-03-15", "end": "2026-03-25", "target": 50, "label": "後半テスト改"},
        )
        self.assertEqual(201, status)
        status, st = self.request("GET", f"{base}/status?at=2026-03-20")
        assert isinstance(st, dict)
        self.assertEqual(("後半テスト改", True), (st["goal"]["label"], st["achieved"]))

        # 目標は消せる。グループ外のユーザーは消せない
        goal_id = quote(str(first["id"]) if isinstance(first, dict) else "", safe="")
        status, denied = self.request("DELETE", f"{base}/goals/{goal_id}?user={quote('はなこ')}")
        self.assertEqual(403, status)
        status, removed = self.request("DELETE", f"{base}/goals/{goal_id}?user={quote('たろう')}")
        self.assertEqual(204, status)

    # ---------- 外部連携 ----------

    def test_outgoing_and_incoming_integrations(self) -> None:
        plugins_tmp = tempfile.TemporaryDirectory()
        self.addCleanup(plugins_tmp.cleanup)
        practice_dir = Path(plugins_tmp.name) / "practice"
        practice_dir.mkdir()
        (practice_dir / "plugin.json").write_text(
            json.dumps(PRACTICE_MANIFEST, ensure_ascii=False), encoding="utf-8"
        )
        self.plugins_dir = Path(plugins_tmp.name)

        received: list[object] = []

        class Receiver(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                length = int(self.headers["Content-Length"])
                received.append(json.loads(self.rfile.read(length).decode("utf-8")))
                self.send_response(200)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *args: object) -> None:
                pass

        receiver = ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
        receiver_thread = threading.Thread(target=receiver.serve_forever, daemon=True)
        receiver_thread.start()
        self.addCleanup(receiver.server_close)
        self.addCleanup(receiver.shutdown)
        host, port = receiver.server_address

        os.environ["TEST_HOOK_URL"] = f"http://{host}:{port}/hook"
        os.environ["TEST_HOOK_TOKEN"] = "himitsu"
        self.addCleanup(os.environ.pop, "TEST_HOOK_URL")
        self.addCleanup(os.environ.pop, "TEST_HOOK_TOKEN")

        self.start()
        status, group = self.request(
            "POST", "/api/plugins/practice/groups", {"name": "勉強会", "members": ["たろう"]}
        )
        self.assertEqual(201, status)
        assert isinstance(group, dict)
        base = f"/api/plugins/practice/groups/{group['id']}"

        status, _ = self.request(
            "POST", f"{base}/goals",
            {"user": "たろう", "start": "2026-05-01", "end": "2026-05-31", "target": 30, "label": "5月"},
        )
        self.assertEqual(201, status)

        status, created = self.request(
            "POST", f"{base}/entries", {"date": "2026-05-01", "owner": "たろう", "data": {"minutes": 40}}
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)

        # entry.created（素の JSON）と goal.achieved（discord 本文）が届く
        self.assertEqual(2, len(received))
        first = received[0]
        assert isinstance(first, dict)
        self.assertEqual("entry.created", first["event"])
        self.assertEqual(created["id"], first["entry"]["id"])
        self.assertEqual({"content": "練習 達成 40/30 (100%)"}, received[1])

        # 受信（ingest）。トークン一致で記録になり、entry.created も飛ぶ
        status, denied = self.request(
            "POST",
            f"{base}/ingest/importer?user={quote('たろう')}",
            {"payload": {"min": 15, "note": "外から", "date": "2026-05-02"}},
            headers={"X-Plugin-Token": "chigau"},
        )
        self.assertEqual(401, status)
        self.assertEqual({"error": "X-Plugin-Token が一致しません"}, denied)

        status, ingested = self.request(
            "POST",
            f"{base}/ingest/importer?user={quote('たろう')}",
            {"payload": {"min": 15, "note": "外から", "date": "2026-05-02"}},
            headers={"X-Plugin-Token": "himitsu"},
        )
        self.assertEqual(201, status)
        assert isinstance(ingested, dict)
        self.assertEqual({"minutes": 15, "memo": "外から"}, ingested["data"])
        self.assertEqual("2026-05-02", ingested["date"])
        self.assertEqual(3, len(received))

        status, missing = self.request(
            "POST",
            f"{base}/ingest/importer?user={quote('たろう')}",
            {"payload": {"note": "min が無い"}},
            headers={"X-Plugin-Token": "himitsu"},
        )
        self.assertEqual(400, status)
        self.assertEqual({"error": "受け取った本文に payload.min がありません"}, missing)

    # ---------- 同梱プラグインのサンプル ----------

    def test_bundled_samples_are_seeded_and_reset(self) -> None:
        self.start()
        status, listed = self.request("GET", "/api/plugins")
        assert isinstance(listed, dict)
        ids = [m["id"] for m in listed["plugins"]]
        for plugin_id in ("fishing", "nisa", "fitness", "pets", "cooking", "study", "game"):
            self.assertIn(plugin_id, ids)
            status, groups = self.request("GET", f"/api/plugins/{plugin_id}/groups")
            self.assertEqual(200, status)
            assert isinstance(groups, dict)
            self.assertEqual(f"{plugin_id}-home", groups["groups"][0]["id"])
            # デモの最初の月（3 月）はどのプラグインも最高段階のエフェクト
            status, st = self.request("GET", f"/api/plugins/{plugin_id}/groups/{plugin_id}-home/status?at=2026-03-31")
            assert isinstance(st, dict)
            manifest = next(m for m in listed["plugins"] if m["id"] == plugin_id)
            top = max(manifest["effects"], key=lambda e: e["minProgress"])["id"]
            self.assertEqual(top, st["effect"], plugin_id)

        # 同じ月に目標が 2 つ（英単語テスト・期末テスト）。月末は後の期末テストの結果
        status, st = self.request("GET", "/api/plugins/study/groups/study-home/status?at=2026-06-30")
        assert isinstance(st, dict)
        self.assertEqual("期末テスト", st["goal"]["label"])
        self.assertFalse(st["achieved"])
        status, st = self.request("GET", "/api/plugins/study/groups/study-home/status?at=2026-06-13")
        assert isinstance(st, dict)
        self.assertEqual(("英単語テスト", True), (st["goal"]["label"], st["achieved"]))

        status, created = self.request(
            "POST", "/api/plugins/fishing/groups/fishing-home/entries",
            {"date": "2026-03-02", "owner": "たろう", "data": {"species": "aji", "count": 3}},
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)
        status, _ = self.request("POST", "/api/reset")
        self.assertEqual(200, status)
        status, body = self.request("GET", "/api/plugins/fishing/groups/fishing-home/entries")
        assert isinstance(body, dict)
        self.assertNotIn(created["id"], [e["id"] for e in body["entries"]])

    def test_year_achievements_counts_plugins_per_month(self) -> None:
        self.start()
        status, body = self.request("GET", f"/api/achievements?year=2026&owner={quote(TARO)}")
        self.assertEqual(200, status)
        assert isinstance(body, dict)
        self.assertEqual(2026, body["year"])
        self.assertEqual([str(m) for m in range(1, 13)], list(body["months"]))
        march = [p["id"] for p in body["months"]["3"]]
        # 3 月はたろうが入っているすべての同梱プラグインが目標達成（自主勉強ははなこだけのグループ）
        self.assertEqual(sorted(["cooking", "fishing", "fitness", "game", "ledger", "nisa", "pets"]), sorted(march))
        # 8 月の家計簿は未達（貯金 -26,400 円）
        self.assertNotIn("ledger", [p["id"] for p in body["months"]["8"]])

        status, body = self.request("GET", f"/api/achievements?year=2026&owner={quote(HANA)}")
        assert isinstance(body, dict)
        self.assertIn("study", [p["id"] for p in body["months"]["3"]])
        self.assertNotIn("fitness", [p["id"] for p in body["months"]["3"]])

        status, bad = self.request("GET", f"/api/achievements?year=abc&owner={quote(TARO)}")
        self.assertEqual(400, status)
        status, missing = self.request("GET", "/api/achievements")
        self.assertEqual(400, status)
        self.assertEqual({"error": "year がありません"}, missing)
        status, missing = self.request("GET", "/api/achievements?year=2026")
        self.assertEqual(400, status)
        self.assertEqual({"error": "owner がありません"}, missing)

    def test_metric_where_filters_entries(self) -> None:
        self.start()
        status, st = self.request("GET", "/api/plugins/nisa/groups/nisa-home/entries?from=2026-03-01&to=2026-03-31")
        assert isinstance(st, dict)
        growth = sum(e["data"].get("amount", 0) for e in st["entries"] if e["data"]["kind"] == "growth")
        manifest = plugins.load_manifest("nisa", self.plugins_dir)
        metric = next(m for m in manifest["metrics"] if m["key"] == "growth")
        self.assertEqual(30_000, growth)
        self.assertEqual(30_000, plugins.compute_metric(metric, st["entries"]))

    # ---------- リセットとエラー応答 ----------

    def test_reset_restores_sample(self) -> None:
        self.start()
        group = self.ledger_group()
        status, created = self.request(
            "POST", f"/api/plugins/ledger/groups/{group}/entries",
            {"date": "2026-04-04", "owner": "たろう", "data": {"kind": "expense", "amount": 800, "title": "消える"}},
        )
        self.assertEqual(201, status)
        assert isinstance(created, dict)

        status, reset = self.request("POST", "/api/reset")
        self.assertEqual(200, status)
        assert isinstance(reset, dict)
        self.assertEqual(["たろう", "はなこ"], reset["members"])

        status, body = self.request("GET", f"/api/plugins/ledger/groups/{group}/entries")
        assert isinstance(body, dict)
        self.assertEqual(len(seed_as_plugin_entries(TARO, group)), len(body["entries"]))
        self.assertNotIn(created["id"], [entry["id"] for entry in body["entries"]])

    def test_unknown_paths_and_methods(self) -> None:
        self.start()
        group = self.ledger_group()

        status, body = self.request("GET", "/api/plugins/nai-plugin")
        self.assertEqual(404, status)
        self.assertEqual({"error": "プラグインが見つかりません: nai-plugin"}, body)

        status, body = self.request("PUT", f"/api/plugins/ledger/groups/{group}/entries", {})
        self.assertEqual(405, status)

        status, body = self.request("GET", f"/api/plugins/ledger/groups/{group}/nazo")
        self.assertEqual(404, status)

        status, body = self.request("GET", "/api/plugins/ledger/groups/nai-group/status")
        self.assertEqual(404, status)
        self.assertEqual({"error": "グループが見つかりません: nai-group"}, body)


class ManifestValidationTest(unittest.TestCase):
    def test_new_plugin_scaffold_is_valid(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        original = plugins.PLUGINS_DIR
        plugins.PLUGINS_DIR = Path(tmp.name)
        self.addCleanup(setattr, plugins, "PLUGINS_DIR", original)
        self.assertEqual(0, new_plugin.main(["reading", "読書"]))
        manifest = plugins.load_manifest("reading", Path(tmp.name))
        self.assertEqual("読書", manifest["name"])
        self.assertTrue((Path(tmp.name) / "reading" / "README.md").is_file())
        with self.assertRaises(FileExistsError):
            new_plugin.main(["reading", "読書"])
        with self.assertRaises(ValueError):
            new_plugin.main(["Bad_ID", "だめ"])

    def test_read_secret_uses_env_file(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env_path = Path(tmp.name) / ".env"
        env_path.write_text("# コメント\nTEST_SECRET_ONLY_IN_FILE = abc123\nEMPTY_ONE=\n", encoding="utf-8")
        original = plugins.ENV_PATH
        plugins.ENV_PATH = env_path
        self.addCleanup(setattr, plugins, "ENV_PATH", original)
        self.assertEqual("abc123", plugins.read_secret("TEST_SECRET_ONLY_IN_FILE", "テスト"))
        with self.assertRaises(plugins.ApiError) as caught:
            plugins.read_secret("EMPTY_ONE", "テスト")
        self.assertEqual(500, caught.exception.status)

    def test_delta_metric_with_lower_is_better_goal(self) -> None:
        metric = {"key": "change", "label": "増減", "agg": "delta", "field": "kg", "op": "<="}
        entries = [
            {"date": "2026-03-20", "data": {"kg": 70.0}},
            {"date": "2026-03-01", "data": {"kg": 72.0}},
            {"date": "2026-03-10", "data": {"memo": "体重なし"}},
        ]
        self.assertEqual(-2.0, plugins.compute_metric(metric, entries))
        self.assertEqual("<=", plugins.goal_op({"goal": {"op": ">="}}, metric))
        achieved, progress = plugins.evaluate("<=", -2.0, -3)
        self.assertFalse(achieved)
        self.assertAlmostEqual(2 / 3, progress)
        self.assertEqual((True, 1.0), plugins.evaluate("<=", -3.5, -3))
        self.assertEqual((False, 0.0), plugins.evaluate("<=", 0.5, -3))

    def valid(self) -> dict:
        return json.loads(json.dumps(PRACTICE_MANIFEST, ensure_ascii=False))

    def test_valid_manifest_passes(self) -> None:
        plugins.validate_manifest(self.valid(), "practice")

    def test_rejects_bad_shapes(self) -> None:
        cases: list[tuple[str, dict]] = []

        wrong_id = self.valid()
        wrong_id["id"] = "betsumono"
        cases.append(("id はフォルダ名と同じ", wrong_id))

        string_options = self.valid()
        string_options["fields"][0] = {
            "key": "kind", "type": "select", "label": "種類", "options": ["a", "b"],
        }
        cases.append(("options は value/label", string_options))

        bad_metric_field = self.valid()
        bad_metric_field["metrics"][0]["field"] = "memo"
        cases.append(("metric.field は数値項目", bad_metric_field))

        bad_goal = self.valid()
        bad_goal["goal"]["metric"] = "nai"
        cases.append(("goal.metric は metrics の key", bad_goal))

        no_default_effect = self.valid()
        no_default_effect["effects"] = [{"id": "plain", "minProgress": 0.5, "theme": "plain"}]
        cases.append(("minProgress 0 が必須", no_default_effect))

        bad_hook = self.valid()
        bad_hook["integrations"][0]["adapter"] = "slack"
        cases.append(("adapter は登録済みのもの", bad_hook))

        for label, manifest in cases:
            with self.assertRaises(ValueError, msg=label):
                plugins.validate_manifest(manifest, "practice")

    def test_scene_effects_are_validated(self) -> None:
        manifest = self.valid()
        fish = {"palette": {"a": "#ff8800"}, "layers": [["aa"]]}
        manifest["effects"][1]["scene"] = {
            "sky": "#101020",
            "sprites": [{"model": fish, "count": 3, "zone": "sea", "motion": "orbit", "size": 0.1}],
        }
        plugins.validate_manifest(manifest, "practice")

        bad_cases = [
            {"model": {"palette": {"a": "red"}, "layers": [["a"]]}, "count": 1, "zone": "sea", "motion": "orbit", "size": 0.1},
            {"model": {"palette": {"a": "#ff0000"}, "layers": [["b"]]}, "count": 1, "zone": "sea", "motion": "orbit", "size": 0.1},
            {"model": fish, "count": 1, "zone": "space", "motion": "orbit", "size": 0.1},
            {"model": fish, "count": 1, "zone": "sea", "motion": "dance", "size": 0.1},
            {"model": fish, "count": 41, "zone": "sea", "motion": "orbit", "size": 0.1},
            {"model": {"palette": {"a": "#ff0000"}, "layers": [["a" * 200]]}, "count": 40, "zone": "sea", "motion": "orbit", "size": 0.1},
        ]
        for sprite in bad_cases:
            broken = self.valid()
            broken["effects"][1]["scene"] = {"sprites": [sprite]}
            with self.assertRaises(ValueError, msg=json.dumps(sprite)[:80]):
                plugins.validate_manifest(broken, "practice")

        unknown_theme = self.valid()
        unknown_theme["effects"][1]["theme"] = "fishing"
        with self.assertRaises(ValueError):
            plugins.validate_manifest(unknown_theme, "practice")

    def test_negate_when_must_reference_select_values(self) -> None:
        manifest = self.valid()
        manifest["fields"].append(
            {"key": "kind", "type": "select", "label": "種類",
             "options": [{"value": "plus", "label": "足す"}, {"value": "minus", "label": "引く"}]}
        )
        manifest["metrics"][0]["negateWhen"] = {"field": "kind", "values": ["minus"]}
        plugins.validate_manifest(manifest, "practice")

        manifest["metrics"][0]["negateWhen"] = {"field": "kind", "values": ["nai"]}
        with self.assertRaises(ValueError):
            plugins.validate_manifest(manifest, "practice")


if __name__ == "__main__":
    unittest.main()
