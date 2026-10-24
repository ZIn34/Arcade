// PULSE TAP — glowing notes slide down three lanes in time with a chiptune beat. Tap a lane as its note
// crosses the line: every hit plays a piece of the tune, so playing well makes the song. Misses drain
// your energy; a run of hits builds a combo multiplier. Every few bars the tempo goes up and the
// patterns get busier, with double notes and off-beats.
// Tap the three lanes (anywhere in a lane counts).
(() => {
  const LANE_COLORS = ["#ff3cc8", "#3cf0ff", "#4dff7a"];
  // the tune the notes play: a chord tone per lane, moving through a four-chord loop
  const CHORDS = [[69, 72, 76], [65, 69, 72], [72, 76, 79], [67, 71, 74]]; // Am F C G
  const BASS = [45, 41, 48, 43];

  Arcade.addGame("pulsetap", {
    // no background song: the beat is made by the game itself so the notes stay in time with it
    howTo: [
      "NOTES SLIDE DOWN 3 LANES",
      "TAP A LANE AS ITS NOTE HITS THE LINE",
      "EVERY HIT PLAYS THE TUNE",
      "MISSES DRAIN YOUR ENERGY",
      "HIT IN A ROW FOR A COMBO",
      "THE BEAT KEEPS SPEEDING UP",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const LANES = 3;
      let laneW, lineY;
      function layout() { laneW = W / LANES; lineY = H - 110; }
      layout();
      const fx = Kit.particles(), banner = Kit.banner();

      let song = -1.5;          // seconds into the song (counts up only while playing)
      let bpm = 96, beat = 0, beatTime = 0, nextGen = 0;
      let notes = [], energy = 100, combo = 0, best = 0, over = false, overT = 0, judge = null, hits = 0, misses = 0;
      const flash = [0, 0, 0];
      const travel = () => Math.max(0.9, 1.7 - (bpm - 96) * 0.008); // seconds a note takes to fall
      const mult = () => Math.min(4, 1 + Math.floor(combo / 10));
      let frameAt = performance.now();

      // the beat clock: each beat has a time; notes are laid out a few beats ahead
      const beatLen = () => 60 / bpm;
      function generate(upTo) {
        while (nextGen < upTo) {
          const b = beat, bt = beatTime;
          const bar = Math.floor(b / 4), chordI = bar % 4;
          const busy = Math.min(1, (bpm - 96) / 70);
          // schedule the backing beat for this beat
          schedule(bt, () => {
            Sound.tone(Sound.N(BASS[chordI]), beatLen() * 0.8, { vol: 0.22, type: "triangle" });
            if (b % 2 === 0) Sound.tone(150, 0.1, { vol: 0.2, type: "triangle", slide: 50 });
            else Sound.noise(0.06, { vol: 0.12, freq: 6000, filter: "highpass" });
          });
          schedule(bt + beatLen() / 2, () => Sound.noise(0.03, { vol: 0.06, freq: 8000, filter: "highpass" }));
          // notes: always something on the first beat of a bar, more as it speeds up
          if (b >= 4) {
            const lane = Kit.irand(0, LANES - 1);
            if (b % 4 === 0 || Math.random() < 0.55 + busy * 0.35) {
              notes.push({ lane, time: bt, chord: chordI, hit: false, missed: false });
              if (Math.random() < busy * 0.35) notes.push({ lane: (lane + Kit.irand(1, 2)) % LANES, time: bt, chord: chordI, hit: false, missed: false });
            }
            if (Math.random() < busy * 0.45) notes.push({ lane: Kit.irand(0, LANES - 1), time: bt + beatLen() / 2, chord: chordI, hit: false, missed: false });
          }
          beat++;
          beatTime += beatLen();
          nextGen = beatTime;
          // every 4 bars the tempo goes up
          if (beat % 16 === 0 && beat > 0) {
            bpm = Math.min(176, bpm + 8);
            const at = beatTime;
            schedule(at, () => { banner.show("FASTER!", bpm + " BPM", "#fff", "#ff3cc8", 1); });
          }
        }
      }
      // sounds and events wait in a list and fire when the song reaches their time
      let queue = [];
      function schedule(time, fn) { queue.push({ time, fn }); }

      function hitLane(lane, atSong) {
        if (over) return;
        flash[lane] = 0.15;
        // the nearest unhit note in this lane
        let bestN = null, bestD = 1e9;
        for (const n of notes) if (n.lane === lane && !n.hit && !n.missed) { const d = Math.abs(n.time - atSong); if (d < bestD) { bestD = d; bestN = n; } }
        const win = 0.16 + Math.max(0, (176 - bpm) / 1000);
        if (bestN && bestD < win) {
          bestN.hit = true;
          const perfect = bestD < 0.06;
          combo++; hits++;
          best = Math.max(best, combo);
          host.addScore((perfect ? 10 : 5) * mult());
          energy = Math.min(100, energy + (perfect ? 2 : 1));
          const pitch = CHORDS[bestN.chord][lane];
          Sound.tone(Sound.N(pitch), 0.22, { vol: 0.2, type: "square", hold: 0.3 });
          Sound.tone(Sound.N(pitch + 12), 0.12, { vol: 0.08, type: "square" });
          judge = { text: perfect ? "PERFECT" : "GOOD", color: perfect ? "#ffd63c" : "#3cf0ff", t: 0.4, lane };
          fx.burst(laneW * (lane + 0.5), lineY, LANE_COLORS[lane], perfect ? 16 : 8, 180, 0.5, 3);
          if (combo > 0 && combo % 25 === 0) { banner.show(combo + " COMBO!", "x" + mult(), "#fff", "#4dff7a", 0.8); Sound.play("bonus"); }
        } else {
          // a tap with nothing there counts as a small slip
          combo = 0;
          energy -= 4;
          Sound.tone(110, 0.08, { vol: 0.12, type: "sawtooth" });
          judge = { text: "OOPS", color: "#888", t: 0.3, lane };
        }
      }

      function update(dt) {
        frameAt = performance.now();
        fx.update(dt); banner.update(dt);
        for (let i = 0; i < 3; i++) flash[i] = Math.max(0, flash[i] - dt);
        if (judge) { judge.t -= dt; if (judge.t <= 0) judge = null; }
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        song += dt;
        generate(song + travel() + 2);
        // fire anything that's due
        queue.sort((a, b) => a.time - b.time);
        while (queue.length && queue[0].time <= song) queue.shift().fn();
        // notes that slipped past the line
        for (const n of notes) {
          if (!n.hit && !n.missed && song - n.time > 0.2) {
            n.missed = true; misses++;
            combo = 0;
            energy -= 10;
            Sound.tone(90, 0.15, { vol: 0.15, type: "sawtooth", slide: 60 });
            judge = { text: "MISS", color: "#ff3c50", t: 0.4, lane: n.lane };
          }
        }
        notes = notes.filter(n => song - n.time < 0.6);
        if (energy <= 0) {
          energy = 0; over = true; overT = 1.2;
          Sound.play("lose");
          banner.show("OUT OF ENERGY", "BEST COMBO " + best, "#fff", "#ff3c50", 1.4);
        }
      }

      function draw(g) {
        g.fillStyle = "#05010c"; g.fillRect(0, 0, W, H);
        const pulse = Math.max(0, 1 - ((song % beatLen()) / beatLen()) * 3);
        for (let l = 0; l < LANES; l++) {
          const x = l * laneW;
          g.fillStyle = l % 2 ? "#0c0618" : "#0a0414"; g.fillRect(x, 0, laneW, H);
          if (flash[l] > 0) { g.globalAlpha = flash[l] * 2; g.fillStyle = LANE_COLORS[l]; g.fillRect(x, 0, laneW, H); g.globalAlpha = 1; }
          g.fillStyle = LANE_COLORS[l]; g.globalAlpha = 0.25; g.fillRect(x + laneW / 2 - 1, 0, 2, lineY); g.globalAlpha = 1;
        }
        // the hit line pulses on the beat
        g.fillStyle = "#fff"; g.globalAlpha = 0.5 + pulse * 0.5; g.fillRect(0, lineY - 2, W, 4); g.globalAlpha = 1;
        for (let l = 0; l < LANES; l++) {
          const cx = laneW * (l + 0.5);
          g.strokeStyle = LANE_COLORS[l]; g.lineWidth = 3;
          g.strokeRect(cx - 26, lineY - 14, 52, 28);
        }
        // notes
        const tr = travel();
        for (const n of notes) {
          if (n.hit) continue;
          const k = 1 - (n.time - song) / tr;
          if (k < -0.05) continue;
          const y = 44 + k * (lineY - 44); // notes enter just below the energy bar
          const cx = laneW * (n.lane + 0.5);
          g.fillStyle = n.missed ? "#333" : LANE_COLORS[n.lane];
          g.globalAlpha = 0.3; g.fillRect(cx - 30, y - 16, 60, 32); g.globalAlpha = 1;
          g.fillRect(cx - 24, y - 11, 48, 22);
          g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(cx - 24, y - 11, 48, 4);
        }
        fx.draw(g);
        if (judge) Kit.text(g, judge.text, laneW * (judge.lane + 0.5), lineY - 40, 10, judge.color);
        // tap pads under the line
        for (let l = 0; l < LANES; l++) {
          g.fillStyle = flash[l] > 0 ? LANE_COLORS[l] : "#140a24";
          g.fillRect(l * laneW + 6, lineY + 24, laneW - 12, H - lineY - 34);
          g.strokeStyle = LANE_COLORS[l]; g.lineWidth = 2; g.strokeRect(l * laneW + 6, lineY + 24, laneW - 12, H - lineY - 34);
        }
        // energy, combo, tempo
        g.fillStyle = "#222"; g.fillRect(8, 8, W - 16, 8);
        g.fillStyle = energy < 30 ? (Math.floor(song * 8) % 2 ? "#fff" : "#ff3c50") : "#4dff7a";
        g.fillRect(8, 8, (W - 16) * energy / 100, 8);
        Kit.text(g, "COMBO " + combo + (mult() > 1 ? "  x" + mult() : ""), 8, 30, 8, "#ffd63c", "left");
        Kit.text(g, bpm + " BPM", W - 8, 30, 8, "#888", "right");
        if (song < 0) Kit.text(g, "GET READY", W / 2, H * 0.35, 14, "#fff", "center", "#ff3cc8");
        banner.draw(g, W, H);
      }

      // a tap lands between frames: add the time since the last frame so timing is fair
      function down(x) {
        const lane = Kit.clamp(Math.floor(x / laneW), 0, LANES - 1);
        hitLane(lane, song + (performance.now() - frameAt) / 1000);
      }

      const state = () => ({ song, bpm, energy, combo, best, hits, misses, over, travel: travel(), lineY, laneW,
        notes: notes.filter(n => !n.hit && !n.missed).map(n => ({ lane: n.lane, time: n.time })) });
      return { update, draw, down, state, resize(w, h) { W = w; H = h; layout(); } };
    },
  });
})();
