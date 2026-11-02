# Lifer's Strategy Arena — AI Rally Game

Previously named ORBIT. The existing `orbit` terminal command still works.

A playable browser strategy game based on the supplied Prototype V1 GDD.
All rules, timing, and AI search run in Python. The frontend is vanilla
HTML, CSS, JavaScript, and SVG. No build step, framework, or database is needed.

## Run

Install Python **3.10 or newer**, clone this repository, and open a terminal
in the cloned folder. Its name and location do not matter.

### One-time setup

Create and activate a virtual environment.

**Windows PowerShell:**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```sh
python3 -m venv .venv
source .venv/bin/activate
```

Then run this same installation command on either OS:

```sh
python -m pip install -e .
```

This registers the `orbit` command and links it to your clone. Code changes
from `git pull` are picked up when you restart the server; reinstall if
the packaging configuration changes. There are no third-party runtime
dependencies; pip may download the build tool during setup.

### Start the game

With the virtual environment active, everyone uses:

```sh
orbit
```

Open **http://127.0.0.1:8000**. Keep the terminal running while playing.
Press Ctrl+C to stop. In a new terminal, activate the environment again
using the activation command above, then run `orbit`.

If PowerShell blocks activation, you can run the installed command directly
from the clone without changing your PowerShell settings:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\orbit.exe
```

To choose another port:

```sh
orbit --port 8001
```

The original no-install launch method also remains available from the
repository root (use `py` on Windows or `python3` on macOS/Linux if needed):

```sh
python run.py
```

For other computers on a trusted college network:

```sh
orbit --host 0.0.0.0 --port 8000
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
- Every participant gets the same verified fixed opening and moves first.
  Neither side starts with a win or a legal one-move win.
- No available moves is a draw. Repetition does not end a match.
- Restart, instructions, legal-move highlights, result display, move history,
  and AI search statistics are included.
- The search target is fixed at seven ply. Pruning can be toggled between
  matches for algorithm comparison. Reloading reconnects to the existing
  match; it does not reset the clock.
- Sound starts enabled after the first interaction; use the header mute
  button to save your preference. Original tones are synthesized locally.
- Pieces slide between nodes with subtle landing effects. Reduced-motion
  preferences skip movement effects. AI presentation lasts at least 650 ms,
  plus a 420 ms move transition; neither interval uses player thinking time.

Independent browser profiles/devices get separate in-memory matches.
Tabs sharing a browser session share a match. Restarting the server clears
all matches. Inactive sessions are removed when a new match is created
after one hour; the in-memory session pool is capped at 1,000.

## Algorithms and assessment

`backend/ai/minimax.py` implements Minimax and optional Alpha-Beta pruning in Python.
Both use the same move ordering, terminal scores, and evaluation function.
The fixed target of seven ply searches individual moves, not full rounds.

The search uses iterative deepening and a 5-second computation budget.
Only fully completed depths replace the chosen decision. At the same completed
depth, enabling pruning preserves the Minimax result. With a time budget,
pruning may complete a deeper search and therefore choose a different move.
The interface shows completed/requested depth, visited states, skipped
branches, and total search time across all iterations.

Terminal scores dominate heuristic scores. The heuristic evaluates the
center, unopposed potential lines, and legal move counts. The timer is not
part of the AI evaluation.

The fixed opening is `(1,2,1,0,2,1,2,0,0)`: player on 01/03/06, AI on
02/05/07, and empty 04/08/center. Every player starts first. Exact retrograde
analysis covers all 3,360 board/turn states (1,680 three-versus-three boards).
This opening has a neutral heuristic, half-turn/color symmetry, five legal
moves per side, and no forced win for either starting side in the **untimed**
game. All five initial moves per side preserve the theoretical draw.
Repetition remains legal in the actual game; the analysis treats indefinitely
avoidable wins as draws and does not add a new runtime draw condition.

This establishes positional balance, not equal win rates against a timed
human. Keep playtesting the 60-second timer. Use the same pruning setting
for participants within a competition category; the toggle is also useful
for separate benchmarks. Reproduce the opening analysis with:

```sh
python -m backend.game.opening_analysis
```

To change the player timer, edit `THINKING_TIME` in `backend/game/settings.py`
(the value is in seconds; `60.0` means one minute). Restart `orbit`, refresh
the browser, and start a new match. The clock, progress bar, and in-game
instructions read this setting automatically. The API provides
`time_limit`, `clock_starts_in`, and `animation_seconds` to the frontend.
The server reserves a bounded transition after an AI move and rejects player
moves during that transition. Refreshing or delaying a request cannot extend
it. Cosmetic thinking delay is excluded from `elapsed_ms` search statistics.

## Code map

The layout follows section 9.2 of the GDD. Python package markers
(`__init__.py`), the HTTP integration tests, and the existing convenience
launcher `run.py` are additional support files.

```text
backend/
  main.py
  game/
    board.py
    rules.py
    settings.py
    opening_analysis.py
  ai/
    minimax.py
    evaluation.py
    difficulty.py
  tests/
    test_rules.py
    test_ai.py
    test_api.py
frontend/
  index.html
  css/
    style.css
  js/
    game.js
    renderer.js
    api.js
    audio.js
requirements.txt
README.md
run.py
```

| File | Responsibility |
| --- | --- |
| `backend/game/board.py` | Board constants, graph, winning triples, immutable movement |
| `backend/game/rules.py` | Legal moves, winning checks, fixed opening and valid analysis pool |
| `backend/game/settings.py` | Name, total thinking time, AI presentation timing |
| `backend/game/opening_analysis.py` | Reproducible exact untimed opening analysis |
| `backend/ai/minimax.py` | Minimax, Alpha-Beta, iterative deepening |
| `backend/ai/evaluation.py` | Positional evaluation |
| `backend/ai/difficulty.py` | Allowed depths, defaults, computation budget |
| `backend/main.py` | API, isolated matches, authoritative clock |
| `frontend/index.html` | Game interface and instructions |
| `frontend/css/style.css` | Responsive visual design |
| `frontend/js/game.js` | Match state, input handling, turn flow |
| `frontend/js/renderer.js` | Board, clock, history, and result rendering |
| `frontend/js/api.js` | Python API requests and response errors |
| `frontend/js/audio.js` | Synthesized sound cues, autoplay unlock, saved mute preference |
| `backend/tests/test_rules.py` | Rule and clock verification |
| `backend/tests/test_ai.py` | AI decisions, pruning, and search budget checks |
| `backend/tests/test_api.py` | HTTP, assets, session isolation, and rejected-request checks |

Internal node IDs are 0–7 clockwise from the top, with center 8.
The UI labels outer nodes 01–08 and uses a star for the center.
Winning triples: `(0,8,4)`, `(6,8,2)`, `(7,8,3)`, `(1,8,5)`.

## Verification

```sh
python -m unittest discover -s backend/tests -v
```

The existing `python run.py` command still works. Alternatively, run
`python -m backend.main` from the project root.

API routes: `POST /api/new`, `POST /api/move`, `POST /api/ai`,
`GET /api/state`. Mutations include the current `ply` to reject stale requests.
Moves and session state are validated and serialized on the server.
The browser countdown is an estimate; Python's monotonic clock decides
timeouts. The clock continues while a human turn is open in another tab or
an instructions/restart dialog is displayed.

Typography uses Google Fonts when online, with system fallbacks when offline.
All game assets are local SVG/CSS; no external image requests are necessary.
