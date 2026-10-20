// Match state, input handling, turn flow, and synchronization.
import { api } from './api.js';
import { createRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const preview = [1, 0, 1, 2, 0, 1, 0, 2, 2];
let state = {status: "idle", board: preview, remaining: 60, history: []};
let selected = null, busy = false, syncedAt = performance.now();
let aiRetryAt = 0, polling = false;
const renderer = createRenderer(selectNode);
function render() { renderer.render(state, selected, busy, syncedAt); }
function updateClock() { renderer.updateClock(state, syncedAt); }

function error(message) { $("error").textContent = message; $("error").hidden = !message; }
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
