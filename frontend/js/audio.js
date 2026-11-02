// Original, synthesized cues: no downloads or external audio assets.
export function createAudio() {
  let context, enabled = true;
  try { enabled = localStorage.getItem('lifer-sound') !== 'off'; } catch (_) {}
  const button = document.getElementById('sound');
  function refresh() {
    button.textContent = enabled ? '♪ Sound on' : '♪ Sound off';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Mute game sounds' : 'Enable game sounds');
  }
  async function unlock() {
    if (!enabled) return;
    try {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') await context.resume();
    } catch (_) { /* Audio support is optional; gameplay must still work. */ }
  }
  function tone(frequency, offset = 0, duration = .14, volume = .045) {
    if (!enabled || context?.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const at = context.currentTime + offset;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .96, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(at); oscillator.stop(at + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function play(event) {
    if (event === 'select') tone(660, 0, .07, .025);
    if (event === 'move') { tone(330); tone(495, .035, .16, .03); }
    if (event === 'ai') { tone(220, 0, .15); tone(330, .045, .18, .03); }
    if (event === 'start') [330, 440, 660].forEach((f, i) => tone(f, i * .09));
    if (event === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, .3));
    if (event === 'loss') [330, 294, 220].forEach((f, i) => tone(f, i * .13, .25, .035));
    if (event === 'draw') { tone(440, 0, .25); tone(554, .13, .25); }
    if (event === 'warning') tone(880, 0, .065, .025);
  }
  button.addEventListener('click', async () => {
    enabled = !enabled;
    try { localStorage.setItem('lifer-sound', enabled ? 'on' : 'off'); } catch (_) {}
    if (!enabled && context) await context.suspend().catch(() => {});
    refresh(); await unlock(); play('select');
  });
  // Browsers allow sound after a user gesture; sound is enabled by default.
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  refresh();
  return { play, unlock };
}
