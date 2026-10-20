# ORBIT — AI Rally Game

A playable browser strategy game based on the supplied Prototype V1 GDD.
All rules, timing, and AI search run in Python. The frontend is vanilla
HTML, CSS, JavaScript, and SVG. No build step, framework, or database is needed.

## Run

Install Python **3.10 or newer**, then from this folder:

```sh
python run.py
```

Open **http://127.0.0.1:8000**. Keep the terminal running while playing.
Stop with Ctrl+C. No packages need to be installed.

For other computers on a trusted college network:

```sh
python run.py --host 0.0.0.0 --port 8000
```

On those computers, open `http://<server-computer-LAN-IP>:8000`.
The host firewall must permit that port. This is a local/demo server, not
a production internet deployment. A static hosting service alone cannot run
the Python backend; deploy the complete Python app to a Python-capable host
behind HTTPS for internet use.

## Play

- Click **Start a match**. Ivory pieces belong to you; green pieces belong to AI.
- Select your piece, then a highlighted adjacent empty position.
- Outer positions connect to their two ring neighbors and the center.
- Win with two opposite outer points plus the center. Edge arcs do not win.
- Your 60-second clock runs only during your turns. Timeout is an AI win.
- The starting board and first player are randomized. Neither side starts
  with a win or a legal one-move win.
- No available moves is a draw. Repetition does not end a match.
- Restart, instructions, legal-move highlights, result display, move history,
  and AI search statistics are included.
- Change search depth and pruning between matches. Reloading the page
  reconnects to the existing match; it does not reset the clock.

Independent browser profiles/devices get separate in-memory matches.
Tabs sharing a browser session share a match. Restarting the server clears
all matches. Inactive sessions are removed when a new match is created
after one hour; the in-memory session pool is capped at 1,000.

## Algorithms and assessment

`backend/ai.py` implements Minimax and optional Alpha-Beta pruning in Python.
Both use the same move ordering, terminal scores, and evaluation function.
Depths 3, 5, and 7 search individual moves (plies), not full rounds.

The search uses iterative deepening and a 0.7-second computation budget.
Only fully completed depths replace the chosen decision. At the same completed
depth, enabling pruning preserves the Minimax result. With a time budget,
pruning may complete a deeper search and therefore choose a different move.
The interface shows completed/requested depth, visited states, skipped
branches, and total search time across all iterations.

Terminal scores dominate heuristic scores. The heuristic evaluates the
center, unopposed potential lines, and legal move counts. The timer is not
part of the AI evaluation.

Starting configurations are exhaustively enumerated once and filtered by
the GDD restrictions. The pool is symmetric under swapping sides, and the
first player is random. This avoids systematic color bias but is not a
proof that every opening has equal game-theoretic value.

## Code map

| File | Responsibility |
| --- | --- |
| `backend/game.py` | Graph, moves, winning lines, valid opening pool |
| `backend/ai.py` | Minimax, Alpha-Beta, evaluation, search budget |
| `backend/server.py` | API, isolated matches, authoritative clock |
| `frontend/index.html` | Game interface and instructions |
| `frontend/style.css` | Responsive visual design |
| `frontend/app.js` | Rendering, inputs, API calls, clock display |
| `tests/test_game.py` | Rule, AI, and clock verification |
| `tests/test_api.py` | HTTP, session isolation, and rejected-request checks |

Internal node IDs are 0–7 clockwise from the top, with center 8.
The UI labels outer nodes 01–08 and uses a star for the center.
Winning triples: `(0,8,4)`, `(6,8,2)`, `(7,8,3)`, `(1,8,5)`.

## Verification

```sh
python -m unittest discover -s tests -v
```

API routes: `POST /api/new`, `POST /api/move`, `POST /api/ai`,
`GET /api/state`. Mutations include the current `ply` to reject stale requests.
Moves and session state are validated and serialized on the server.
The browser countdown is an estimate; Python's monotonic clock decides
timeouts. The clock continues while a human turn is open in another tab or
an instructions/restart dialog is displayed.

Typography uses Google Fonts when online, with system fallbacks when offline.
All game assets are local SVG/CSS; no external image requests are necessary.
