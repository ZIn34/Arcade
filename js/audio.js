// Chiptune sound: every effect and tune is synthesised here with Web Audio (no sound files except the
// CREXZ intro). iPhone only allows sound after a tap, so nothing plays until unlock() is called from one.
const Sound = (() => {
  const MUTE_KEY = "crexz-arcade.muted";
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = Save.getItem(MUTE_KEY) === "1";
  const listeners = [];

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Older iPhones need a sound started inside the tap itself to wake the audio up.
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination);
      b.start(0);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function isMuted() { return muted; }
  function setMuted(m) {
    muted = m;
    Save.setItem(MUTE_KEY, m ? "1" : "0");
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    listeners.forEach(f => f(m));
  }
  function toggleMute() { setMuted(!muted); }
  function onMuteChange(f) { listeners.push(f); }

  // One note: square/triangle/sawtooth/sine, with an optional pitch slide.
  function tone(freq, dur, opt = {}) {
    if (!ctx) return;
    const t = (opt.at != null ? opt.at : ctx.currentTime) + (opt.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opt.type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slide), t + dur);
    const v = opt.vol != null ? opt.vol : 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.setValueAtTime(v, t + Math.max(0.006, dur * (opt.hold != null ? opt.hold : 0.4)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, opt = {}) {
    if (!ctx) return;
    const t = (opt.at != null ? opt.at : ctx.currentTime) + (opt.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || "lowpass";
    f.frequency.setValueAtTime(opt.freq || 3000, t);
    if (opt.slide) f.frequency.exponentialRampToValueAtTime(opt.slide, t + dur);
    const g = ctx.createGain();
    const v = opt.vol != null ? opt.vol : 0.3;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opt.bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note to Hz

  // The arcade's shared sound effects. Games can also call tone()/noise() for their own.
  const fx = {
    move: () => tone(N(84), 0.04, { vol: 0.15 }),
    select: () => { tone(N(76), 0.06, { vol: 0.2 }); tone(N(83), 0.08, { vol: 0.2, delay: 0.06 }); },
    back: () => { tone(N(79), 0.06, { vol: 0.2 }); tone(N(72), 0.08, { vol: 0.2, delay: 0.06 }); },
    coin: () => { tone(N(83), 0.08, { vol: 0.25 }); tone(N(88), 0.35, { vol: 0.25, delay: 0.08, hold: 0.2 }); },
    credit: () => [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.09, { vol: 0.22, delay: i * 0.07 })),
    start: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.08, { vol: 0.2, delay: i * 0.05 })),
    point: () => tone(N(88), 0.07, { vol: 0.2, type: "square" }),
    bonus: () => [84, 88, 91, 96].forEach((n, i) => tone(N(n), 0.06, { vol: 0.18, delay: i * 0.045 })),
    shoot: () => tone(1400, 0.1, { vol: 0.12, slide: 300, type: "square" }),
    hit: () => { tone(200, 0.12, { vol: 0.25, slide: 60, type: "square" }); noise(0.1, { vol: 0.2, freq: 2000 }); },
    boom: () => { noise(0.5, { vol: 0.4, freq: 2500, slide: 120 }); tone(120, 0.4, { vol: 0.2, slide: 30, type: "triangle" }); },
    jump: () => tone(300, 0.16, { vol: 0.18, slide: 900, type: "square" }),
    bounce: () => tone(N(72), 0.05, { vol: 0.18, type: "square" }),
    power: () => [0, 1, 2, 3, 4, 5].forEach(i => tone(N(72 + i * 3), 0.06, { vol: 0.15, delay: i * 0.04, type: "triangle" })),
    lose: () => { tone(400, 0.5, { vol: 0.22, slide: 90, type: "sawtooth" }); },
    gameover: () => [72, 67, 64, 60, 55].forEach((n, i) => tone(N(n), i === 4 ? 0.6 : 0.16, { vol: 0.22, delay: i * 0.16, type: "square" })),
    highscore: () => [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tone(N(n), 0.12, { vol: 0.2, delay: i * 0.1 })),
  };
  function play(name) { if (fx[name]) fx[name](); }

  // ---- music: a tiny step sequencer with look-ahead scheduling ----
  // A song is a list of tracks; each track is a step string of MIDI notes ("." = rest, "-" = hold).
  const songs = {};
  function defineSong(name, song) { songs[name] = song; }

  let seq = null;
  function playMusic(name, tempoScale = 1) {
    stopMusic();
    if (!ctx || !songs[name]) return;
    const song = songs[name];
    seq = { song, step: 0, next: ctx.currentTime + 0.08, tempo: tempoScale, timer: null };
    const tick = () => {
      if (!seq) return;
      const s = seq;
      const stepDur = 60 / (song.bpm * s.tempo) / 4;
      while (s.next < ctx.currentTime + 0.15) {
        for (const tr of song.tracks) {
          const len = tr.notes.length;
          const n = tr.notes[s.step % len];
          if (n == null) continue;
          if (tr.drum) {
            if (n === "k") tone(150, 0.12, { at: s.next, vol: tr.vol, slide: 40, type: "triangle", bus: musicBus });
            else if (n === "s") noise(0.1, { at: s.next, vol: tr.vol, freq: 4000, filter: "highpass", bus: musicBus });
            else if (n === "h") noise(0.03, { at: s.next, vol: tr.vol * 0.5, freq: 8000, filter: "highpass", bus: musicBus });
            continue;
          }
          let holdSteps = 1;
          while (tr.notes[(s.step + holdSteps) % len] === "-" && holdSteps < len) holdSteps++;
          if (n === "-") continue;
          tone(N(n + (tr.shift || 0)), stepDur * holdSteps * 0.92, { at: s.next, vol: tr.vol, type: tr.type, hold: 0.6, bus: musicBus });
        }
        s.next += stepDur;
        s.step++;
      }
      s.timer = setTimeout(tick, 40);
    };
    tick();
  }
  function setTempo(scale) { if (seq) seq.tempo = scale; }
  function stopMusic() { if (seq) { clearTimeout(seq.timer); seq = null; } }

  // Parses "A3 . C4 - E4" style strings into note arrays.
  function notes(str) {
    const names = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return str.trim().split(/\s+/).map(tok => {
      if (tok === ".") return null;
      if (tok === "-") return "-";
      if (/^[ksh]$/.test(tok)) return tok;
      const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
      if (!m) return null;
      return 12 * (parseInt(m[3], 10) + 1) + names[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    });
  }

  // The hall tune: a slow, moody arpeggio loop (Am - F - C - G).
  defineSong("hall", {
    bpm: 100,
    tracks: [
      { type: "triangle", vol: 0.5, notes: notes(
        "A2 - - - A2 - - - A2 - - - A2 - E2 -  F2 - - - F2 - - - F2 - - - F2 - C2 -  C2 - - - C2 - - - C2 - - - C2 - G2 -  G2 - - - G2 - - - G2 - - - G2 - B2 -") },
      { type: "square", vol: 0.1, notes: notes(
        "A4 C5 E5 C5 A4 C5 E5 A5  A4 C5 E5 C5 A4 C5 E5 C5  F4 A4 C5 A4 F4 A4 C5 F5  F4 A4 C5 A4 F4 A4 C5 A4  " +
        "E4 G4 C5 G4 E4 G4 C5 E5  E4 G4 C5 G4 E4 G4 C5 G4  D4 G4 B4 G4 D4 G4 B4 D5  D4 G4 B4 G4 B4 D5 G5 D5") },
      { type: "square", vol: 0.12, notes: notes(
        "E5 - - - - - D5 C5  D5 - - - E5 - - -  C5 - - - - - A4 C5  D5 - C5 - A4 - - -  " +
        "G4 - - - C5 - - -  E5 - D5 - C5 - - -  B4 - - - D5 - G5 -  - - F#5 - D5 - - -") },
      { drum: true, vol: 0.18, notes: notes("k . h . s . h .  k . h k s . h h") },
    ],
  });

  // The intro sound is the studio's own recording, played through the same output so mute applies.
  let introSrc = null;
  async function loadIntro(url) {
    if (!ctx) return null;
    try {
      const data = await (await fetch(url)).arrayBuffer();
      return await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
    } catch (e) { return null; }
  }
  function playBuffer(buf, vol) {
    if (!ctx || !buf) return;
    introSrc = ctx.createBufferSource();
    introSrc.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    introSrc.connect(g); g.connect(master);
    introSrc.start();
  }
  function stopBuffer() { if (introSrc) { try { introSrc.stop(); } catch (e) {} introSrc = null; } }

  // Pause everything when the app goes to the background; resume when it comes back.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { unlock, isMuted, setMuted, toggleMute, onMuteChange, tone, noise, play, N, notes,
    defineSong, playMusic, stopMusic, setTempo, loadIntro, playBuffer, stopBuffer,
    get ctx() { return ctx; } };
})();
