"""予定・管理プラグイン HTTP サーバー。127.0.0.1:8787 だけを受け付ける。"""

from __future__ import annotations

import json
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import db
import plugins
import suggest

HOST = "127.0.0.1"
PORT = 8787
DB_PATH = Path(__file__).resolve().parent / "data" / "ledger.sqlite"
PLUGINS_DIR = Path(__file__).resolve().parents[1] / "plugins"


class LedgerHTTPServer(ThreadingHTTPServer):
    """持ち物提案は外部 API 待ちが長いので、他のリクエストを止めないようスレッドで受ける。"""

    allow_reuse_address = True
    daemon_threads = True


def _read_body(handler: BaseHTTPRequestHandler) -> object:
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


def make_handler(db_path: Path, plugins_dir: Path) -> type[BaseHTTPRequestHandler]:
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
            except plugins.ApiError as exc:
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
            if path == "/api/plugins" or path.startswith("/api/plugins/"):
                status, payload = plugins.handle(
                    self.command,
                    path,
                    parsed.query,
                    self.headers,
                    lambda: _read_body(self),
                    db_path,
                    plugins_dir,
                )
                if status == 204:
                    self._write_empty(204)
                else:
                    self._write_json(status, payload)
                return
            if self.command == "GET" and path == "/api/health":
                self._write_json(200, {"ok": True})
                return
            if self.command == "GET" and path == "/api/calendar":
                self._write_json(200, db.fetch_calendar(db_path))
                return
            if self.command == "POST" and path == "/api/reset":
                self._write_json(200, db.reset_demo(db_path, plugins_dir))
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
            } or action is not None:
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


def serve(db_path: Path, host: str = HOST, port: int = PORT, plugins_dir: Path = PLUGINS_DIR) -> LedgerHTTPServer:
    if host != HOST:
        raise RuntimeError("listen host は 127.0.0.1 だけです")
    db.ensure_ready(db_path, plugins_dir)
    return LedgerHTTPServer((host, port), make_handler(db_path, plugins_dir))


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
