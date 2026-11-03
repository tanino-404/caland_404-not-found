"""予定と管理プラグインの HTTP サーバー。127.0.0.1:8787 だけを受け付ける。"""

from __future__ import annotations

import json
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import db
import plugin_store
import suggest

HOST = "127.0.0.1"
PORT = 8787
DB_PATH = Path(__file__).resolve().parent / "data" / "ledger.sqlite"


class LedgerHTTPServer(ThreadingHTTPServer):
    """持ち物提案は外部 API 待ちが長いので、他のリクエストを止めないようスレッドで受ける。"""

    allow_reuse_address = True
    daemon_threads = True


def _read_body(handler: BaseHTTPRequestHandler) -> dict:
    header = handler.headers.get("Content-Length")
    if header is None:
        raise db.LedgerError(400, "Content-Length がありません")
    try:
        length = int(header)
    except ValueError as exc:
        raise db.LedgerError(400, str(exc)) from exc
    if length < 0:
        raise db.LedgerError(400, "Content-Length が不正です")
    raw = handler.rfile.read(length)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise db.LedgerError(400, str(exc)) from exc
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise db.LedgerError(400, str(exc)) from exc
    return payload


def _query_user(query: str) -> str:
    params = parse_qs(query, keep_blank_values=True)
    if "user" not in params:
        raise db.LedgerError(400, "user がありません")
    if len(params["user"]) != 1:
        raise db.LedgerError(400, "user は 1 つだけ指定してください")
    user = params["user"][0].strip()
    if user == "":
        raise db.LedgerError(400, "user が空です")
    return user


def _event_action(path: str) -> tuple[str, str] | None:
    prefix = "/api/events/"
    if not path.startswith(prefix):
        return None
    rest = unquote(path[len(prefix) :])
    if rest.count("/") != 1:
        return None
    event_id, action = rest.split("/", 1)
    if event_id == "" or "/" in event_id or action not in ("join", "leave"):
        return None
    return event_id, action


def _plugin_route(path: str) -> tuple[str, ...] | None:
    """/api/plugins 配下を (種別, ...) に分解する。該当しなければ None。"""
    if path == "/api/plugins":
        return ("list",)
    prefix = "/api/plugins/"
    if not path.startswith(prefix):
        return None
    parts = [unquote(part) for part in path[len(prefix) :].split("/")]
    if any(part == "" for part in parts):
        return None
    if len(parts) == 2 and parts[1] == "entries":
        return ("entries", parts[0])
    if len(parts) == 3 and parts[1] == "entries":
        return ("entry", parts[0], parts[2])
    if len(parts) == 2 and parts[1] == "goals":
        return ("goals", parts[0])
    if len(parts) == 2 and parts[1] == "inbound":
        return ("inbound", parts[0])
    return None


def make_handler(db_path: Path) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self._dispatch()

        def do_POST(self) -> None:
            self._dispatch()

        def do_PUT(self) -> None:
            self._dispatch()

        def do_DELETE(self) -> None:
            self._dispatch()

        def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
            if message is None:
                message = self.responses[int(code)][0]
            self._write_json(int(code), {"error": message})

        def _dispatch(self) -> None:
            try:
                self._route()
            except db.LedgerError as exc:
                self._fail(exc.status, exc)
            except Exception as exc:
                self._fail(500, exc)

        def _fail(self, status: int, exc: BaseException) -> None:
            if status >= 500:
                traceback.print_exc()
            try:
                self._write_json(status, {"error": str(exc)})
            except Exception:
                traceback.print_exc()
                raise

        def _route(self) -> None:
            parsed = urlparse(self.path)
            path = parsed.path
            action = _event_action(path)
            plugin = _plugin_route(path)
            if self.command == "GET" and path == "/api/health":
                self._write_json(200, {"ok": True})
                return
            if self.command == "GET" and path == "/api/calendar":
                self._write_json(200, db.fetch_calendar(db_path))
                return
            if self.command == "GET" and plugin == ("list",):
                self._write_json(200, plugin_store.fetch_plugins(db_path))
                return
            if self.command == "POST" and plugin is not None and plugin[0] == "entries":
                self._write_json(201, plugin_store.add_entry(db_path, plugin[1], _read_body(self)))
                return
            if self.command == "DELETE" and plugin is not None and plugin[0] == "entry":
                plugin_store.delete_entry(db_path, plugin[1], plugin[2], _query_user(parsed.query))
                self._write_empty(204)
                return
            if self.command == "PUT" and plugin is not None and plugin[0] == "goals":
                self._write_json(200, plugin_store.set_goal(db_path, plugin[1], _read_body(self)))
                return
            if self.command == "POST" and plugin is not None and plugin[0] == "inbound":
                token = self.headers.get("X-Plugin-Token")
                self._write_json(201, plugin_store.inbound(db_path, plugin[1], token, _read_body(self)))
                return
            if self.command == "POST" and path == "/api/reset":
                self._write_json(200, plugin_store.reset_demo(db_path))
                return
            if self.command == "POST" and path == "/api/members":
                self._write_json(200, db.add_member(db_path, _read_body(self)))
                return
            if self.command == "POST" and path == "/api/events":
                self._write_json(201, db.add_event(db_path, _read_body(self)))
                return
            if self.command == "POST" and path == "/api/suggest":
                self._write_json(200, suggest.run(_read_body(self)))
                return
            if self.command == "POST" and action is not None:
                event_id, name = action
                body = _read_body(self)
                if name == "join":
                    self._write_json(200, db.join_event(db_path, event_id, body))
                    return
                self._write_json(200, db.leave_event(db_path, event_id, body))
                return
            if path in {
                "/api/health",
                "/api/calendar",
                "/api/reset",
                "/api/members",
                "/api/events",
                "/api/suggest",
            } or plugin is not None or action is not None:
                raise db.LedgerError(405, f"method not allowed: {self.command} {path}")
            raise db.LedgerError(404, f"not found: {path}")

        def _write_json(self, status: int, payload: object) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _write_empty(self, status: int) -> None:
            self.send_response(status)
            self.send_header("Content-Length", "0")
            self.end_headers()

    return Handler


def serve(db_path: Path, host: str = HOST, port: int = PORT) -> LedgerHTTPServer:
    if host != HOST:
        raise RuntimeError("listen host は 127.0.0.1 だけです")
    db.ensure_ready(db_path)
    plugin_store.ensure_ready(db_path)
    return LedgerHTTPServer((host, port), make_handler(db_path))


def main() -> None:
    httpd = serve(DB_PATH, HOST, PORT)
    host, port = httpd.server_address
    print(f"http://{host}:{port}", flush=True)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
