const $ = id => document.getElementById(id);
const coords = Array.from({length: 8}, (_, i) => {
  const a = i * Math.PI / 4;
  return [300 + 213 * Math.sin(a), 300 - 213 * Math.cos(a)];
}).concat([[300, 300]]);
const preview = [1, 0, 1, 2, 0, 1, 0, 2, 2];
let state = {status: "idle", board: preview, remaining: 60, history: []};
let selected = null, busy = false, syncedAt = performance.now(), shownResult = false;
let aiRetryAt = 0, polling = false;
const humanPiece = `<svg class="piece" viewBox="0 0 50 70" aria-hidden="true"><path d="M9 62L13 53H37L41 62L36 67H14Z" fill="#b7ad91"/><path d="M18 31H32L36 54L25 61L14 54Z" fill="#e6dec6"/><path d="M25 7L37 23L32 33H18L13 23Z" fill="#f6f0df"/><path d="M25 7V33L13 23Z" fill="#c9bea2"/><path d="M25 35V59L14 54L18 33Z" fill="#bdb294"/><path d="M14 54L25 59L36 54" stroke="#fff3d5" fill="none"/><path d="M25 7L37 23L25 18Z" fill="#fffbef"/></svg>`;
const aiPiece = `<svg class="piece" viewBox="0 0 50 70" aria-hidden="true"><path d="M9 62L13 53H37L41 62L36 67H14Z" fill="#4c7769"/><path d="M18 31H32L36 54L25 61L14 54Z" fill="#7aa692"/><path d="M25 7L37 23L32 33H18L13 23Z" fill="#a0c1ac"/><path d="M25 7V33L13 23Z" fill="#537c6d"/><path d="M25 35V59L14 54L18 33Z" fill="#456c60"/><path d="M14 54L25 59L36 54" stroke="#adccb1" fill="none"/><path d="M25 7L37 23L25 18Z" fill="#c1dac0"/></svg>`;
const nodes = coords.map(([x,y], i) => {
  const button = document.createElement("button");
  button.className = "node";
  button.style.left = `${x / 6}%`;
  button.style.top = `${y / 6}%`;
  button.addEventListener("click", () => selectNode(i));
  $("board").append(button);
  return button;
});
const positionName = i => i === 8 ? "Center" : String(i + 1).padStart(2, "0");
function error(message) { $("error").textContent = message; $("error").hidden = !message; }
async function api(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not reach the game server.");
  return data;
}
function accept(data) {
  state = data.status === "idle" ? {status:"idle", board:preview, remaining:60, history:[]} : data;
  syncedAt = performance.now();
  selected = null;
  if (state.depth) {
    $("depth").value = state.depth;
    $("pruning").checked = state.pruning;
  }
  render();
}
function render() {
  const active = state.status === "playing", humanTurn = active && state.turn === 1;
  const available = (state.legal_moves || []).filter(m => m[0] === selected).map(m => m[1]);
  const last = state.history?.at(-1);
  nodes.forEach((node, i) => {
    const owner = state.board[i], legal = available.includes(i);
    node.className = `node ${owner === 1 ? "human" : owner === 2 ? "ai" : "empty"}${selected === i ? " selected" : ""}${legal ? " legal" : ""}${last?.to === i ? " last-move" : ""}${state.winning_line?.includes(i) ? " winner" : ""}`;
    node.innerHTML = `${owner === 1 ? humanPiece : owner === 2 ? aiPiece : ""}<span class="node-number">${i === 8 ? "✦" : positionName(i)}</span>`;
    node.disabled = busy || !humanTurn || (owner !== 1 && !legal);
    node.setAttribute("aria-label", `${positionName(i)}: ${owner === 1 ? "your piece" : owner === 2 ? "AI piece" : "empty"}${legal ? ", legal destination" : ""}`);
    node.setAttribute("aria-pressed", String(selected === i));
  });
  $("win-line").innerHTML = state.winning_line ? `<line x1="${coords[state.winning_line[0]][0]}" y1="${coords[state.winning_line[0]][1]}" x2="${coords[state.winning_line[2]][0]}" y2="${coords[state.winning_line[2]][1]}" stroke="#e8cf91" stroke-width="5" opacity=".9"/>` : "";
  const ended = !active && state.status !== "idle";
  if (!ended) {
    $("result").hidden = true;
    shownResult = false;
  }
  $("turn-title").textContent = state.status === "idle" ? "Take your position." : ended ? "A match to remember." : humanTurn ? "Your move." : "ORBIT is thinking.";
  $("turn-description").textContent = state.status === "idle" ? "A little strategy goes a long way." : ended ? "A new possibility is one click away." : humanTurn ? (selected === null ? "Select an ivory piece to begin." : available.length ? "Choose a glowing empty point." : "This piece is blocked. Choose another.") : "Exploring the next possibilities…";
  $("turn-icon").textContent = humanTurn ? "◇" : ended ? "✦" : "◎";
  document.querySelector(".match-card").classList.toggle("thinking", active && !humanTurn);
  $("round-label").textContent = active ? `MOVE ${String((state.ply || 0) + 1).padStart(2, "0")} / ${humanTurn ? "YOUR TURN" : "AI TURN"}` : ended ? "MATCH COMPLETE" : "READY WHEN YOU ARE";
  $("mobile-turn").textContent = active ? humanTurn ? "YOUR TURN · IVORY" : "AI TURN · CLOCK PAUSED" : ended ? "MATCH COMPLETE" : "READY TO PLAY";
  $("clock-state").textContent = active ? humanTurn ? "RUNNING" : "PAUSED · AI TURN" : ended ? "FINISHED" : "60 SECONDS TOTAL";
  $("start").innerHTML = `${state.status === "idle" ? "Start a match" : "New match"} <span>↗</span>`;
  $("start").disabled = busy;
  $("play-again").disabled = busy;
  $("depth").disabled = $("pruning").disabled = active || busy;
  $("depth-name").textContent = {"3":"Gentle","5":"Balanced","7":"Challenging"}[$("depth").value];
  $("start-note").textContent = active ? "Ivory is yours. Make a line through the center." : "Random board. Coin flip for the first move.";
  $("move-count").textContent = state.ply ? `${state.ply} ${state.ply === 1 ? "MOVE" : "MOVES"} PLAYED` : "NO MOVES YET";
  $("history").innerHTML = state.history?.length ? state.history.map(m => `<span class="move-chip ${m.player === 2 ? "ai" : ""}"><small>${String(m.number).padStart(2,"0")}</small>${m.player === 1 ? "YOU" : "AI"} <b>${positionName(m.from)} → ${positionName(m.to)}</b></span>`).join("") : '<span class="history-empty">Every good game starts with a possibility.</span>';
  $("history").scrollLeft = $("history").scrollWidth;
  if (state.stats) {
    $("stat-nodes").textContent = state.stats.nodes.toLocaleString();
    $("stat-time").textContent = `${Math.round(state.stats.elapsed_ms)}ms`;
    $("stat-depth").textContent = `DEPTH ${state.stats.depth}/${state.stats.target_depth}`;
    $("search-note").textContent = `${state.stats.pruned.toLocaleString()} branches skipped. ${state.stats.depth < state.stats.target_depth ? "Time budget reached; last complete depth used." : "Requested search depth completed."}`;
  } else {
    $("stat-nodes").textContent = $("stat-time").textContent = "—";
    $("stat-depth").textContent = `DEPTH ${$("depth").value}`;
    $("search-note").textContent = "Search details appear after the AI's first move.";
  }
  $("stat-algorithm").textContent = $("pruning").checked ? "MINIMAX + ALPHA-BETA" : "MINIMAX";
  if (ended && !shownResult) {
    shownResult = true;
    $("result-title").textContent = state.status === "human_win" ? "Beautifully played." : state.status === "draw" ? "An even orbit." : "A move ahead.";
    $("result-description").textContent = state.status === "human_win" ? "Three pieces. One perfect line. This orbit is yours." : state.status === "draw" ? "No legal moves remain. The match is a draw." : state.reason === "timeout" ? "Your thinking time ran out. Take a fresh board and try again." : "ORBIT AI found its line. A new board is a new opportunity.";
    $("result").hidden = false;
  }
  updateClock();
}
function updateClock() {
  let time = state.remaining ?? 60;
  if (state.status === "playing" && state.turn === 1) time -= (performance.now() - syncedAt) / 1000;
  time = Math.max(0, time);
  const whole = Math.floor(time);
  $("mobile-clock").textContent = `${String(Math.floor(whole / 60)).padStart(2,"0")}:${String(whole % 60).padStart(2,"0")}`;
  $("clock").innerHTML = `${String(Math.floor(whole / 60)).padStart(2,"0")}<span>:</span>${String(whole % 60).padStart(2,"0")}<small>.${Math.floor(time * 10) % 10}</small>`;
  $("clock-progress").style.width = `${time / 60 * 100}%`;
  document.querySelector(".clock-block").classList.toggle("urgent", time < 10);
}
async function newMatch() {
  if (busy || polling) return;
  busy = true; selected = null;
  $("result").hidden = true; error(""); render();
  try {
    accept(await api("new", {depth:Number($("depth").value), pruning:$("pruning").checked}));
  } catch (e) { error(`${e.message} Check the Python server and try again.`); }
  finally { busy = false; render(); }
  await aiTurn();
}
async function selectNode(i) {
  if (busy || polling || state.status !== "playing" || state.turn !== 1) return;
  if (state.board[i] === 1) {
    selected = selected === i ? null : i;
    render(); return;
  }
  if (!(state.legal_moves || []).some(m => m[0] === selected && m[1] === i)) return;
  busy = true; error(""); render();
  try { accept(await api("move", {from:selected, to:i, ply:state.ply})); }
  catch (e) { error(e.message); }
  finally { busy = false; render(); }
  await aiTurn();
}
async function aiTurn() {
  if (busy || polling || state.status !== "playing" || state.turn !== 2 || Date.now() < aiRetryAt) return;
  busy = true; render();
  try {
    accept(await api("ai", {ply:state.ply}));
    error("");
  } catch (e) {
    aiRetryAt = Date.now() + 3000;
    error(`${e.message} Reconnecting…`);
    try { accept(await api("state")); } catch (_) {}
  } finally { busy = false; render(); }
}
$("start").addEventListener("click", () => state.status === "playing" ? $("restart-dialog").showModal() : newMatch());
$("confirm-restart").addEventListener("click", () => { $("restart-dialog").close(); newMatch(); });
$("cancel-restart").addEventListener("click", () => $("restart-dialog").close());
$("play-again").addEventListener("click", newMatch);
$("view-board").addEventListener("click", () => { $("result").hidden = true; });
$("help").addEventListener("click", () => $("help-dialog").showModal());
["close-help", "got-it"].forEach(id => $(id).addEventListener("click", () => $("help-dialog").close()));
$("depth").addEventListener("change", render);
$("pruning").addEventListener("change", render);
$("insight-toggle").addEventListener("click", () => {
  const hidden = !$("insight-body").hidden;
  $("insight-body").hidden = hidden;
  $("insight-toggle").setAttribute("aria-expanded", String(!hidden));
  $("insight-chevron").textContent = hidden ? "+" : "−";
});
setInterval(updateClock, 100);
setInterval(async () => {
  if (busy || polling || state.status !== "playing") return;
  if (state.turn === 2) return aiTurn();
  polling = true;
  try {
    const fresh = await api("state");
    if (fresh.status !== state.status || fresh.ply !== state.ply) accept(fresh);
    else { state.remaining = fresh.remaining; syncedAt = performance.now(); }
  } catch (e) { error("Connection lost. Your server clock continues; reconnecting…"); }
  finally { polling = false; }
}, 1000);
render();
(async () => {
  busy = true; render();
  try { accept(await api("state")); }
  catch (e) { error("Start the Python server to connect to the game."); }
  finally { busy = false; render(); }
  await aiTurn();
})();
