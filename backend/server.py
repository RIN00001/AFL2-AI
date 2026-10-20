"""Single-process HTTP application. No third-party packages or database needed."""
import argparse
import json
import secrets
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from random import choice
from threading import Lock
from time import monotonic
from urllib.parse import urlsplit

from backend.ai import choose_move
from backend.game import AI, HUMAN, legal_moves, moved, new_board, winning_line

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
MATCHES = {}
MATCHES_LOCK = Lock()
SESSION_TTL = 3600


@dataclass
class Match:
    board: tuple = field(default_factory=new_board)
    turn: int = field(default_factory=lambda: choice((HUMAN, AI)))
    remaining: float = 60.0
    started: float | None = None
    status: str = "playing"
    reason: str | None = None
    line: tuple | None = None
    ply: int = 0
    history: list = field(default_factory=list)
    stats: dict | None = None
    depth: int = 5
    pruning: bool = True
    touched: float = field(default_factory=monotonic)
    lock: Lock = field(default_factory=Lock)

    def __post_init__(self):
        if self.turn == HUMAN:
            self.started = monotonic()

    def tick(self):
        now = monotonic()
        self.touched = now
        if self.status == "playing" and self.turn == HUMAN and self.started is not None:
            self.remaining = max(0, self.remaining - (now - self.started))
            self.started = now
            if self.remaining == 0:
                self.status, self.reason, self.started = "ai_win", "timeout", None

    def apply(self, move):
        player = self.turn
        self.board = moved(self.board, move)
        self.ply += 1
        self.history.append({"player": player, "from": move[0], "to": move[1],
                             "number": self.ply})
        self.line = winning_line(self.board, player)
        self.started = None
        if self.line:
            self.status = "human_win" if player == HUMAN else "ai_win"
            self.reason = "alignment"
        else:
            self.turn = 3 - player
            if not legal_moves(self.board, self.turn):
                self.status, self.reason = "draw", "no_moves"
            elif self.turn == HUMAN:
                self.started = monotonic()

    def snapshot(self):
        self.tick()
        return {"board": self.board, "turn": self.turn, "remaining": self.remaining,
                "status": self.status, "reason": self.reason, "winning_line": self.line,
                "legal_moves": legal_moves(self.board, self.turn) if self.status == "playing" else [],
                "ply": self.ply, "history": self.history[-30:], "stats": self.stats,
                "depth": self.depth, "pruning": self.pruning}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def reply(self, status, data, cookie=None):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            self.send_header("Set-Cookie", f"orbit_session={cookie}; HttpOnly; SameSite=Strict; Path=/")
        self.end_headers()
        self.wfile.write(body)

    def session_id(self):
        for item in self.headers.get("Cookie", "").split(";"):
            key, _, value = item.strip().partition("=")
            if key == "orbit_session":
                return value
        return None

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/state":
            with MATCHES_LOCK:
                match = MATCHES.get(self.session_id())
            if not match:
                return self.reply(200, {"status": "idle"})
            with match.lock:
                return self.reply(200, match.snapshot())
        if path.startswith("/api/"):
            return self.reply(404, {"error": "Unknown endpoint."})
        super().do_GET()

    def do_POST(self):
        # Same-origin browser requests only; no permissive CORS.
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            return self.reply(403, {"error": "Request origin is not allowed."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 <= size <= 4096:
                raise ValueError
            data = json.loads(self.rfile.read(size) or b"{}")
            if not isinstance(data, dict):
                raise ValueError
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, {"error": "Invalid request."})
        path = urlsplit(self.path).path
        if path == "/api/new":
            depth = data.get("depth", 5)
            pruning = data.get("pruning", True)
            if type(depth) is not int or depth not in (3, 5, 7) or type(pruning) is not bool:
                return self.reply(400, {"error": "Invalid AI settings."})
            match = Match(depth=depth, pruning=pruning)
            sid = secrets.token_urlsafe(24)
            with MATCHES_LOCK:
                old = self.session_id()
                MATCHES.pop(old, None)
                expired = [key for key, value in MATCHES.items()
                           if monotonic() - value.touched > SESSION_TTL]
                for key in expired:
                    del MATCHES[key]
                if len(MATCHES) >= 1000:
                    return self.reply(503, {"error": "The server is busy. Please try again later."})
                MATCHES[sid] = match
            return self.reply(200, match.snapshot(), cookie=sid)
        if path not in ("/api/move", "/api/ai"):
            return self.reply(404, {"error": "Unknown endpoint."})
        with MATCHES_LOCK:
            match = MATCHES.get(self.session_id())
        if not match:
            return self.reply(404, {"error": "Start a new match first."})
        with match.lock:
            match.tick()
            if match.status != "playing":
                return self.reply(200, match.snapshot())
            if data.get("ply") != match.ply:
                return self.reply(409, {"error": "The board changed. Please try again."})
            if path == "/api/move":
                move = (data.get("from"), data.get("to"))
                if (match.turn != HUMAN or any(type(i) is not int for i in move)
                        or move not in legal_moves(match.board, HUMAN)):
                    return self.reply(400, {"error": "That move is not available."})
                match.apply(move)
            else:
                if match.turn != AI:
                    return self.reply(409, {"error": "It is your turn."})
                move, match.stats = choose_move(match.board, match.depth, match.pruning)
                if move is None:
                    match.status, match.reason = "draw", "no_moves"
                else:
                    match.apply(move)
            return self.reply(200, match.snapshot())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"ORBIT is ready at http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
