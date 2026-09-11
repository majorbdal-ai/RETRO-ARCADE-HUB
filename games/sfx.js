/* ============================================================
   RETRO ARCADE HUB — SFX ENGINE (v7.15)
   Web Audio API synthesizer — Nokia-era chiptune blips & buzzes
   No audio files needed. All engines call playSfx() safely.
   Keys: hit, coin, click, over, win, launch, continue, flap, pop, move
   ============================================================ */
(function () {
  let ctx = null, master = null, muted = false;
  const SOUND_KEY = 'rah_sound'; // user pref (muted when '0')

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    // resume on first gesture (mobile policy)
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function isMuted() {
    try { return localStorage.getItem(SOUND_KEY) === '0'; } catch (e) { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';               // square = classic arcade
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol || 0.2;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const SOUNDS = {
    hit:    () => { tone(180, .12, 'sawtooth', .25, 60); noise(.06, .12); },
    coin:   () => { tone(880, .09, 'square', .22); setTimeout(() => { try { tone(1320, .12, 'square', .22); } catch (e) {} }, 70); },  // classic 2-note pickup
    click:  () => tone(520, .05, 'square', .15),
    over:   () => { tone(330, .18, 'sawtooth', .25, 110); setTimeout(() => { try { tone(165, .3, 'sawtooth', .28, 60); } catch (e) {} }, 140); }, // sad trombone-ish
    win:    () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => { try { tone(f, .12, 'square', .22); } catch (e) {} }, i * 90)); },
    launch: () => { tone(220, .18, 'square', .25, 660); noise(.08, .1); },
    continue: () => { [392, 523, 659].forEach((f, i) => setTimeout(() => { try { tone(f, .15, 'square', .25); } catch (e) {} }, i * 110)); },
    flap:   () => tone(640, .07, 'square', .2, 320),
    pop:    () => { tone(700, .06, 'square', .2); setTimeout(() => tone(980, .08, 'square', .18), 40); },
    move:   () => tone(420, .04, 'square', .1),
    win2:   () => { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => { try { tone(f, .14, 'triangle', .25); } catch (e) {} }, i * 100)); },
    error:  () => { tone(200, .2, 'sawtooth', .2, 90); },
    shoot:  () => noise(.1, .18),
    boost:  () => tone(140, .35, 'sawtooth', .2, 880),
    slide:  () => tone(300, .12, 'sawtooth', .15, 150),
  };

  window.playSfx = function (name) {
    if (typeof name !== 'string') return;
    const key = String(name).toLowerCase();
    const fn = SOUNDS[key];
    if (typeof fn !== 'function') return; // unknown key → silent (no-op)
    try { muted = isMuted(); fn(); } catch (e) { /* audio unavailable → silent */ }
  };
  // one-shot pings for engines that want var pitch (e.g. flappy flap pitch)
  window.sfxTone = tone;
  window.toggleSound = function () {
    let m = isMuted();
    m = !m;
    try { localStorage.setItem(SOUND_KEY, m ? '0' : '1'); } catch (e) {}
    muted = m;
    if (!m) { try { ensure(); } catch (e) {} window.playSfx('click'); }
    return !m;
  };
  // unlock audio on first user gesture (autoplay policy)
  function unlock() {
    try { ensure(); } catch (e) {}
    try { window.removeEventListener('touchend', unlock); } catch (e) {}
    try { window.removeEventListener('click', unlock); } catch (e) {}
  }
  try { window.addEventListener('touchend', unlock); } catch (e) {}
  try { window.addEventListener('click', unlock); } catch (e) {}
})();