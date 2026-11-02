// Board, status, history, result, and timer presentation.
const $ = id => document.getElementById(id);
const coords = Array.from({length: 8}, (_, i) => {
  const a = i * Math.PI / 4;
  return [300 + 213 * Math.sin(a), 300 - 213 * Math.cos(a)];
}).concat([[300, 300]]);
const humanPiece = `<svg class="piece" viewBox="0 0 50 70" aria-hidden="true"><path d="M9 62L13 53H37L41 62L36 67H14Z" fill="#b7ad91"/><path d="M18 31H32L36 54L25 61L14 54Z" fill="#e6dec6"/><path d="M25 7L37 23L32 33H18L13 23Z" fill="#f6f0df"/><path d="M25 7V33L13 23Z" fill="#c9bea2"/><path d="M25 35V59L14 54L18 33Z" fill="#bdb294"/><path d="M14 54L25 59L36 54" stroke="#fff3d5" fill="none"/><path d="M25 7L37 23L25 18Z" fill="#fffbef"/></svg>`;
const aiPiece = `<svg class="piece" viewBox="0 0 50 70" aria-hidden="true"><path d="M9 62L13 53H37L41 62L36 67H14Z" fill="#4c7769"/><path d="M18 31H32L36 54L25 61L14 54Z" fill="#7aa692"/><path d="M25 7L37 23L32 33H18L13 23Z" fill="#a0c1ac"/><path d="M25 7V33L13 23Z" fill="#537c6d"/><path d="M25 35V59L14 54L18 33Z" fill="#456c60"/><path d="M14 54L25 59L36 54" stroke="#adccb1" fill="none"/><path d="M25 7L37 23L25 18Z" fill="#c1dac0"/></svg>`;

export function createRenderer(onSelect) {
  let shownResult = false;
  const nodes = coords.map(([x,y], i) => {
    const button = document.createElement("button");
    button.className = "node";
    button.style.left = `${x / 6}%`;
    button.style.top = `${y / 6}%`;
    button.addEventListener("click", () => onSelect(i));
    $("board").append(button);
    return button;
  });
  const positionName = i => i === 8 ? "Center" : String(i + 1).padStart(2, "0");
  function render(state, selected, busy, syncedAt) {
    if (state.time_limit !== undefined) $("help-time-limit").textContent = state.time_limit;
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
    const arriving = humanTurn && busy && state.clock_starts_in > 0;
    $("turn-title").textContent = state.status === "idle" ? "Take your position." : ended ? "A match to remember." : arriving ? "Watch the next move." : humanTurn ? "Your move." : "Lifer is thinking.";
    $("turn-description").textContent = state.status === "idle" ? "A little strategy goes a long way." : ended ? "A new possibility is one click away." : arriving ? "Your clock resumes when the piece lands." : humanTurn ? (selected === null ? "Select an ivory piece to begin." : available.length ? "Choose a glowing empty point." : "This piece is blocked. Choose another.") : "Exploring the next possibilities…";
    $("turn-icon").textContent = humanTurn ? "◇" : ended ? "✦" : "◎";
    document.querySelector(".match-card").classList.toggle("thinking", active && !humanTurn);
    document.querySelector(".board-wrap").classList.toggle("thinking", active && !humanTurn);
    document.querySelector(".board-wrap").classList.toggle("victory", state.status === "human_win");
    $("round-label").textContent = active ? `MOVE ${String((state.ply || 0) + 1).padStart(2, "0")} / ${humanTurn ? "YOUR TURN" : "AI TURN"}` : ended ? "MATCH COMPLETE" : "READY WHEN YOU ARE";
    $("mobile-turn").textContent = active ? arriving ? "AI IS MOVING · CLOCK PAUSED" : humanTurn ? "YOUR TURN · IVORY" : "AI TURN · CLOCK PAUSED" : ended ? "MATCH COMPLETE" : "READY TO PLAY";
    $("start").innerHTML = `${state.status === "idle" ? "Start a match" : "New match"} <span>↗</span>`;
    $("start").disabled = busy;
    $("play-again").disabled = busy;
    $("pruning").disabled = active || busy;
    $("depth-name").textContent = state.depth ? `${state.depth} PLY · FIXED` : "—";
    $("start-note").textContent = active ? "Ivory is yours. Make a line through the center." : "Same opening. You move first. Make it count.";
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
      $("stat-depth").textContent = `DEPTH ${state.depth ?? "—"}`;
      $("search-note").textContent = "Search details appear after the AI's first move.";
    }
    const usedPruning = state.stats ? state.stats.algorithm === 'Alpha-Beta' : $("pruning").checked;
    $("stat-algorithm").textContent = usedPruning ? "MINIMAX + ALPHA-BETA" : "MINIMAX";
    if (ended && !shownResult && !busy) {
      shownResult = true;
      $("result-title").textContent = state.status === "human_win" ? "Beautifully played." : state.status === "draw" ? "Evenly matched." : "A move ahead.";
      $("result-description").textContent = state.status === "human_win" ? "Three pieces. One perfect line. The arena is yours." : state.status === "draw" ? "No legal moves remain. The match is a draw." : state.reason === "timeout" ? "Your thinking time ran out. Reset the arena and try again." : "Lifer found its line. Your next strategy starts here.";
      $("result-time").textContent = `${Math.max(0, state.time_limit - state.remaining).toFixed(1)}s thinking time · ${state.ply} moves`;
      $("result").hidden = false;
    }
    updateClock(state, syncedAt);
  }
  function updateClock(state, syncedAt) {
    if (state.remaining === undefined) return Infinity;
    let time = state.remaining;
    const elapsed = (performance.now() - syncedAt) / 1000;
    const grace = state.clock_starts_in || 0;
    if (state.status === "playing" && state.turn === 1) time -= Math.max(0, elapsed - grace);
    time = Math.max(0, time);
    const whole = Math.floor(time);
    $("clock-state").textContent = state.status === "idle" ? `${state.time_limit} SECONDS TOTAL` : state.status !== "playing" ? "FINISHED" : state.turn !== 1 ? "PAUSED · AI TURN" : elapsed < grace ? "PAUSED · MOVING" : "RUNNING";
    $("mobile-clock").textContent = `${String(Math.floor(whole / 60)).padStart(2,"0")}:${String(whole % 60).padStart(2,"0")}`;
    $("clock").innerHTML = `${String(Math.floor(whole / 60)).padStart(2,"0")}<span>:</span>${String(whole % 60).padStart(2,"0")}<small>.${Math.floor(time * 10) % 10}</small>`;
    $("clock-progress").style.width = `${Math.min(100, time / state.time_limit * 100)}%`;
    document.querySelector(".clock-block").classList.toggle("urgent", time < 10);
    return time;
  }

  async function animateMove(previous, next, seconds = .42) {
    const move = next.history?.at(-1);
    if (!move || previous.board[move.from] !== move.player ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const duration = Math.max(0, seconds * 1000 - 20);
    if (!duration) return;
    const board = $("board"), destination = nodes[move.to].querySelector('.piece');
    const ghost = document.createElement('div');
    ghost.className = 'moving-piece'; ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = move.player === 1 ? humanPiece : aiPiece;
    board.append(ghost);
    if (destination) destination.style.visibility = 'hidden';
    try {
      await ghost.animate([
        {left: `${coords[move.from][0] / 6}%`, top: `${coords[move.from][1] / 6}%`},
        {left: `${coords[move.to][0] / 6}%`, top: `${coords[move.to][1] / 6}%`}
      ], {duration, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards'}).finished;
    } finally {
      ghost.remove();
      if (destination) destination.style.visibility = '';
    }
    const ring = document.createElement('div');
    ring.className = `arrival-ring ${move.player === 2 ? 'ai' : ''}`;
    ring.style.left = `${coords[move.to][0] / 6}%`; ring.style.top = `${coords[move.to][1] / 6}%`;
    ring.setAttribute('aria-hidden', 'true'); board.append(ring);
    const effect = ring.animate([{transform:'translate(-50%,-50%) scale(.7)',opacity:.8},
      {transform:'translate(-50%,-50%) scale(1.7)',opacity:0}], {duration:500});
    effect.finished.catch(() => {}).finally(() => ring.remove());
  }
  return { render, updateClock, animateMove };
}
