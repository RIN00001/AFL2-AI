"""HTTP integration checks using a separate temporary server on a random port."""
import http.cookiejar
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from backend.main import Handler, MATCHES, MATCHES_LOCK
from backend.game.rules import valid_start
from backend.game.rules import FIXED_OPENING
from backend.game.settings import THINKING_TIME


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.cookies = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, path, data=None, client=None):
        request = urllib.request.Request(
            self.url + path,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with (client or self.client).open(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_sessions_are_isolated_and_reload_keeps_board(self):
        _, first = self.request("/api/new", {})
        self.assertTrue(valid_start(tuple(first["board"])))
        other = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        _, empty = self.request("/api/state", client=other)
        self.assertEqual(empty["status"], "idle")
        self.request("/api/new", {}, client=other)
        _, reloaded = self.request("/api/state")
        self.assertEqual(reloaded["board"], first["board"])
        self.assertEqual(reloaded["turn"], first["turn"])

    def test_move_validation_stale_requests_and_ai_reply(self):
        _, state = self.request("/api/new", {"depth": 4, "pruning": True})
        if state["turn"] == 2:
            _, state = self.request("/api/ai", {"ply": state["ply"]})
        before = state["ply"]
        code, _ = self.request("/api/move", {"from": -1, "to": 8, "ply": before})
        self.assertEqual(code, 400)
        source, target = state["legal_moves"][0]
        code, state = self.request("/api/move", {"from": source, "to": target, "ply": before})
        self.assertEqual(code, 200)
        self.assertEqual(state["ply"], before + 1)
        code, _ = self.request("/api/ai", {"ply": before})
        self.assertEqual(code, 409)
        if state["status"] == "playing":
            code, state = self.request("/api/ai", {"ply": state["ply"]})
            self.assertEqual(code, 200)
            self.assertEqual(state["ply"], before + 2)
            self.assertIsNotNone(state["stats"])
            self.assertEqual(state["stats"]["target_depth"], 4)

    def test_timeout_cannot_be_bypassed_by_move_request(self):
        _, state = self.request("/api/new", {})
        if state["turn"] == 2:
            _, state = self.request("/api/ai", {"ply": state["ply"]})
        sid = next(iter(self.cookies)).value
        with MATCHES_LOCK:
            match = MATCHES[sid]
        with match.lock:
            match.started -= 61
        source, target = state["legal_moves"][0]
        _, result = self.request("/api/move", {"from": source, "to": target, "ply": state["ply"]})
        self.assertEqual(result["status"], "ai_win")
        self.assertEqual(result["reason"], "timeout")
        self.assertEqual(result["board"], state["board"])

    def test_bad_settings_and_cross_origin_are_rejected(self):
        code, _ = self.request("/api/new", {"depth": 100})
        self.assertEqual(code, 400)
        request = urllib.request.Request(self.url + "/api/new", data=b"{}",
                                        headers={"Origin": "https://example.com"})
        with self.assertRaises(urllib.error.HTTPError) as context:
            self.client.open(request)
        self.assertEqual(context.exception.code, 403)

    def test_frontend_is_served(self):
        with self.client.open(self.url + "/") as response:
            self.assertEqual(response.status, 200)
            html = response.read()
            self.assertIn(b"Lifer's Strategy Arena", html)
            self.assertIn(b'href="/css/style.css"', html)
            self.assertIn(b'type="module" src="/js/game.js"', html)
        for path in ("/css/style.css", "/js/game.js", "/js/renderer.js", "/js/api.js", "/js/audio.js"):
            with self.subTest(path=path), self.client.open(self.url + path) as response:
                self.assertEqual(response.status, 200)
                self.assertTrue(response.read())
                if path.endswith(".js"):
                    self.assertIn(response.headers.get_content_type(),
                                  ("text/javascript", "application/javascript"))

    def test_fixed_settings_restart_and_idle_preview(self):
        _, preview = self.request('/api/state')
        self.assertEqual(preview['board'], list(FIXED_OPENING))
        self.assertEqual(preview['time_limit'], THINKING_TIME)
        for pruning in (False, True):
            code, state = self.request('/api/new', {'pruning': pruning})
            self.assertEqual(code, 200)
            self.assertEqual(state['depth'], 4)
            self.assertEqual(state['pruning'], pruning)
            self.assertEqual(state['board'], list(FIXED_OPENING))
            self.assertEqual(state['turn'], 1)
            self.assertGreater(state['remaining'], THINKING_TIME - 1)
        self.assertEqual(self.request('/api/new', {'depth': 3})[0], 400)

    def test_ai_transition_has_bounded_grace_and_rejects_early_moves(self):
        _, state = self.request('/api/new', {})
        source, target = state['legal_moves'][0]
        _, state = self.request('/api/move', {'from': source, 'to': target, 'ply': state['ply']})
        saved_time = state['remaining']
        _, state = self.request('/api/ai', {'ply': state['ply']})
        self.assertEqual(state['remaining'], saved_time)
        self.assertGreater(state['clock_starts_in'], 0)
        self.assertLessEqual(state['clock_starts_in'], state['animation_seconds'])
        source, target = state['legal_moves'][0]
        code, _ = self.request('/api/move', {'from': source, 'to': target, 'ply': state['ply']})
        self.assertEqual(code, 409)


if __name__ == "__main__":
    unittest.main()
