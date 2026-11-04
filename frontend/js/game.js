// Match state, input handling, turn flow, and synchronization.
import { api } from './api.js';
import { createRenderer } from './renderer.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const audio = createAudio();
// Local display state is replaced by Python snapshots; Python owns the match rules.
let state = {status: 'idle', board: Array(9).fill(0), history: []};
let selected = null, busy = true, syncedAt = performance.now();
let aiRetryAt = 0, polling = false, warned = false;
const renderer = createRenderer(selectNode);
const wait = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
function render() { renderer.render(state, selected, busy, syncedAt); }
function updateClock() {
  const time = renderer.updateClock(state, syncedAt);
  if (!warned && state.status === 'playing' && state.turn === 1 && time <= 10) {
    warned = true; audio.play('warning');
  }
}
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
async function accept(data, animate = false) {
  // Response flow: keep the old board for animation, then render the server's new state.
  const previous = state;
  state = data;
  syncedAt = performance.now();
  selected = null;
  if (state.pruning !== undefined) $('pruning').checked = state.pruning;
  render();
  if (animate && state.ply === (previous.ply || 0) + 1) {
    const seconds = state.turn === 1 && state.status === 'playing'
      ? Math.min(state.animation_seconds, state.clock_starts_in)
      : state.animation_seconds;
    await renderer.animateMove(previous, state, seconds);
    audio.play(state.history.at(-1).player === 2 ? 'ai' : 'move');
  }
  // A bounded server transition interval, never a client-controlled pause.
  if (animate && state.status === 'playing' && state.turn === 1) {
    await wait(state.clock_starts_in * 1000 - (performance.now() - syncedAt));
  }
  if (previous.status === 'playing' && state.status !== 'playing') {
    audio.play(state.status === 'human_win' ? 'win' : state.status === 'draw' ? 'draw' : 'loss');
  }
}
async function newMatch() {
  if (busy || polling) return;
  busy = true; selected = null; warned = false;
  $('result').hidden = true; error(''); render();
  try {
    await audio.unlock();
    const timerMinutes = Number($('timer-minutes').value);
    const depth = Number($('difficulty').value);
    const match = await api('new', {
      pruning: $('pruning').checked,
      timer_minutes: timerMinutes,
      depth
    });
    await accept(match);
    if (match.time_limit !== timerMinutes * 60) {
      error(`Server started a ${match.time_limit / 60}-minute match instead of ${timerMinutes}. Restart the Python server, then start a new match again.`);
    } else if (match.depth !== depth) {
      error(`Server started the ${match.depth}-ply difficulty instead of ${depth} ply. Restart the Python server, then start a new match again.`);
    }
    audio.play('start');
  } catch (e) { error(e.message + ' Check the Python server and try again.'); }
  finally { busy = false; render(); }
  await aiTurn();
}
async function selectNode(i) {
  if (busy || polling || state.status !== 'playing' || state.turn !== 1) return;
  // First click selects your piece; it does not move anything yet.
  if (state.board[i] === 1) {
    selected = selected === i ? null : i;
    audio.play('select'); render(); return;
  }
  // Second click must match a legal (source, target) pair supplied by Python.
  if (!(state.legal_moves || []).some(m => m[0] === selected && m[1] === i)) return;
  busy = true; error(''); render();
  // Example opening action: screen 01 -> Center sends {from: 0, to: 8, ply: 0}.
  // accept() waits for the server's validated result before updating the board.
  try { await accept(await api('move', {from: selected, to: i, ply: state.ply}), true); }
  catch (e) { error(e.message); }
  finally { busy = false; render(); }
  await aiTurn();
}
async function aiTurn() {
  if (busy || polling || state.status !== 'playing' || state.turn !== 2 || Date.now() < aiRetryAt) return;
  busy = true; render();
  try {
    // Python chooses the AI move; its response uses the same accept/render flow.
    await accept(await api('ai', {ply: state.ply}), true);
    error('');
  } catch (e) {
    aiRetryAt = Date.now() + 3000;
    error(e.message + ' Reconnecting…');
    try { await accept(await api('state')); } catch (_) {}
  } finally { busy = false; render(); }
}
$('start').addEventListener('click', () => state.status === 'playing' ? $('restart-dialog').showModal() : newMatch());
$('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); newMatch(); });
$('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
$('play-again').addEventListener('click', newMatch);
$('view-board').addEventListener('click', () => { $('result').hidden = true; });
$('help').addEventListener('click', () => $('help-dialog').showModal());
['close-help', 'got-it'].forEach(id => $(id).addEventListener('click', () => $('help-dialog').close()));
$('timer-minutes').addEventListener('change', render);
$('pruning').addEventListener('change', render);
$('insight-toggle').addEventListener('click', () => {
  const hidden = !$('insight-body').hidden;
  $('insight-body').hidden = hidden;
  $('insight-toggle').setAttribute('aria-expanded', String(!hidden));
  $('insight-chevron').textContent = hidden ? '+' : '−';
});
setInterval(updateClock, 100);
setInterval(async () => {
  if (busy || polling || state.status !== 'playing') return;
  if (state.turn === 2) return aiTurn();
  polling = true;
  try {
    const fresh = await api('state');
    if (fresh.status !== state.status || fresh.ply !== state.ply) await accept(fresh);
    else { state.remaining = fresh.remaining; state.clock_starts_in = fresh.clock_starts_in; syncedAt = performance.now(); }
  } catch (e) { error('Connection lost. Your server clock continues; reconnecting…'); }
  finally { polling = false; }
}, 500);
render();
(async () => {
  try { await accept(await api('state')); }
  catch (e) { error('Start the Python server to connect to the game.'); }
  finally { busy = false; render(); }
  await aiTurn();
})();
