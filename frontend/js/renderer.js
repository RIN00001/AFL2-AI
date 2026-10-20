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
    updateClock(state, syncedAt);
  }
  function updateClock(state, syncedAt) {
    let time = state.remaining ?? 60;
    if (state.status === "playing" && state.turn === 1) time -= (performance.now() - syncedAt) / 1000;
    time = Math.max(0, time);
    const whole = Math.floor(time);
    $("mobile-clock").textContent = `${String(Math.floor(whole / 60)).padStart(2,"0")}:${String(whole % 60).padStart(2,"0")}`;
    $("clock").innerHTML = `${String(Math.floor(whole / 60)).padStart(2,"0")}<span>:</span>${String(whole % 60).padStart(2,"0")}<small>.${Math.floor(time * 10) % 10}</small>`;
    $("clock-progress").style.width = `${time / 60 * 100}%`;
    document.querySelector(".clock-block").classList.toggle("urgent", time < 10);
  }

  return { render, updateClock };
}
