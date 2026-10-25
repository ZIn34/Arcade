// GLOW WORM — eat the sparks and grow; every few sparks the worm speeds up and a rock lands on the field.
// Swipe in any direction to turn.
(() => {
  Sound.defineSong("gloworm", {
    bpm: 120,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "C3 . G2 . C3 . G2 .  F2 . C3 . F2 . C3 .  G2 . D3 . G2 . D3 .  C3 . G2 . C3 E3 G3 .") },
      { type: "square", vol: 0.09, notes: Sound.notes(
        "E5 . G5 . C6 . G5 .  A5 . F5 . C5 . F5 .  B4 . D5 . G5 . D5 .  E5 . C5 . G4 . . .  " +
        "E5 . G5 . C6 . D6 .  C6 . A5 . F5 . A5 .  G5 . F5 . D5 . B4 .  C5 . . . . . . .") },
      { drum: true, vol: 0.15, notes: Sound.notes("k . h . s . h .") },
    ],
  });

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  Arcade.addGame("gloworm", {
    music: "gloworm",
    deck: { stick: true, buttons: [{ id: "a", label: "TURN L", color: "#4dff7a" }, { id: "b", label: "TURN R", color: "#ffd63c" }] },
    arcadeHowTo: [
      "JOYSTICK: POINT THE WAY TO GO",
      "OR TURN L / TURN R TO TURN",
      "EAT SPARKS TO GROW",
      "DON'T HIT WALLS, ROCKS OR YOURSELF",
      "IT SPEEDS UP AS YOU GROW",
    ],
    howTo: [
      "SWIPE TO TURN THE WORM",
      "EAT SPARKS TO GROW",
      "GOLD SPARKS ARE WORTH MORE",
      "DON'T HIT WALLS, ROCKS OR YOURSELF",
      "IT SPEEDS UP AS YOU GROW",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 15;
      let cell, rows, ox, oy;
      function layout() {
        // leave room round the edge for the glowing wall
        cell = Math.floor(Math.min((W - 16) / COLS, (H - 30) / 18));
        rows = Math.floor((H - 30) / cell);
        ox = Math.floor((W - cell * COLS) / 2);
        oy = Math.floor((H - cell * rows) / 2) + 6;
      }
      layout();

      const fx = Kit.particles(), banner = Kit.banner();
      const midY = Math.floor(rows / 2);
      let worm = [[5, midY], [4, midY], [3, midY]];
      let dir = DIRS.right, queue = [];
      let stepT = 0, stepEvery = 0.17, eaten = 0, level = 1;
      let spark = null, gold = null, rocks = [], dead = false, deadT = 0, t = 0, grow = 0;
      let swipe = null;

      const key = (x, y) => x + "," + y;
      function free(x, y) {
        if (worm.some(s => s[0] === x && s[1] === y)) return false;
        if (rocks.some(r => r[0] === x && r[1] === y)) return false;
        if (spark && spark[0] === x && spark[1] === y) return false;
        if (gold && gold.x === x && gold.y === y) return false;
        return true;
      }
      function randomFree(avoidHead = 0) {
        for (let i = 0; i < 500; i++) {
          const x = Kit.irand(0, COLS - 1), y = Kit.irand(0, rows - 1);
          const h = worm[0];
          if (avoidHead && Math.abs(x - h[0]) + Math.abs(y - h[1]) < avoidHead) continue;
          if (free(x, y)) return [x, y];
        }
        return null;
      }
      spark = randomFree();
      let started = false; // the worm waits for the first swipe

      function step() {
        if (queue.length) {
          const nd = queue.shift();
          if (nd[0] !== -dir[0] || nd[1] !== -dir[1]) dir = nd;
        }
        const h = worm[0];
        const nx = h[0] + dir[0], ny = h[1] + dir[1];
        const hitsSelf = worm.slice(0, worm.length - (grow > 0 ? 0 : 1)).some(s => s[0] === nx && s[1] === ny);
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= rows || hitsSelf || rocks.some(r => r[0] === nx && r[1] === ny)) {
          dead = true; deadT = 1.1;
          Sound.play("lose");
          worm.forEach((s, i) => fx.burst(ox + s[0] * cell + cell / 2, oy + s[1] * cell + cell / 2, i ? "#4dff7a" : "#fff", 4, 120, 0.8, 3));
          return;
        }
        worm.unshift([nx, ny]);
        if (grow > 0) grow--; else worm.pop();

        if (spark && nx === spark[0] && ny === spark[1]) {
          eaten++;
          grow += 2;
          host.addScore(10 * level);
          Sound.tone(Sound.N(76 + (eaten % 8)), 0.08, { vol: 0.2 });
          fx.burst(ox + nx * cell + cell / 2, oy + ny * cell + cell / 2, "#ffd63c", 10, 120, 0.4, 3);
          spark = randomFree();
          if (eaten % 5 === 0) levelUp();
          if (!gold && Math.random() < 0.18) {
            const p = randomFree(4);
            if (p) gold = { x: p[0], y: p[1], life: 6 };
          }
        }
        if (gold && nx === gold.x && ny === gold.y) {
          host.addScore(50 * level);
          grow += 1;
          Sound.play("bonus");
          fx.burst(ox + nx * cell + cell / 2, oy + ny * cell + cell / 2, "#fff", 18, 160, 0.6, 3);
          gold = null;
        }
      }

      function levelUp() {
        level++;
        stepEvery = Math.max(0.06, stepEvery * 0.88);
        const p = randomFree(5);
        if (p) rocks.push(p);
        if (level % 2 === 0) { const q = randomFree(5); if (q) rocks.push(q); }
        banner.show("SPEED UP!", "LEVEL " + level, "#fff", "#4dff7a", 1.2);
        Sound.play("power");
        host.tempo = Math.min(1.5, 1 + (level - 1) * 0.06);
        Sound.setTempo(host.tempo);
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (dead) { deadT -= dt; if (deadT <= 0) host.gameOver(); return; }
        if (!started) return;
        if (gold) { gold.life -= dt; if (gold.life <= 0) gold = null; }
        stepT += dt;
        while (stepT >= stepEvery && !dead) { stepT -= stepEvery; step(); }
      }

      function draw(g) {
        g.fillStyle = "#010a04";
        g.fillRect(0, 0, W, H);
        // the field: a faint grid with a glowing border
        g.fillStyle = "#031a0a";
        g.fillRect(ox, oy, cell * COLS, cell * rows);
        g.fillStyle = "#06240f";
        for (let x = 0; x <= COLS; x++) g.fillRect(ox + x * cell, oy, 1, cell * rows);
        for (let y = 0; y <= rows; y++) g.fillRect(ox, oy + y * cell, cell * COLS, 1);
        g.strokeStyle = "#4dff7a";
        g.lineWidth = 2;
        g.globalAlpha = 0.25; g.strokeRect(ox - 4, oy - 4, cell * COLS + 8, cell * rows + 8);
        g.globalAlpha = 1; g.strokeRect(ox - 1, oy - 1, cell * COLS + 2, cell * rows + 2);

        // rocks
        for (const r of rocks) {
          const x = ox + r[0] * cell, y = oy + r[1] * cell;
          g.fillStyle = "#5a4a40"; g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          g.fillStyle = "#8a7a6a"; g.fillRect(x + 2, y + 2, cell - 6, cell / 3);
          g.fillStyle = "#3a2a20"; g.fillRect(x + cell / 2, y + cell / 2, cell / 3, cell / 3);
        }
        // the spark pulses
        if (spark) {
          const x = ox + spark[0] * cell, y = oy + spark[1] * cell, p = 0.5 + 0.5 * Math.sin(t * 8);
          g.fillStyle = "#ffd63c";
          g.globalAlpha = 0.25 + 0.2 * p; g.fillRect(x - 2, y - 2, cell + 4, cell + 4); g.globalAlpha = 1;
          const q = Math.floor(cell * 0.25);
          g.fillRect(x + q, y + q, cell - 2 * q, cell - 2 * q);
          g.fillStyle = "#fff"; g.fillRect(x + cell / 2 - 1, y + q, 2, 2);
        }
        if (gold && (gold.life > 1.5 || Math.floor(t * 10) % 2)) {
          const x = ox + gold.x * cell, y = oy + gold.y * cell;
          g.fillStyle = "#fff";
          g.globalAlpha = 0.3; g.fillRect(x - 3, y - 3, cell + 6, cell + 6); g.globalAlpha = 1;
          g.fillStyle = "#ffe98a"; g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          g.fillStyle = "#fff"; g.fillRect(x + cell / 2 - 2, y + 3, 4, cell - 6); g.fillRect(x + 3, y + cell / 2 - 2, cell - 6, 4);
        }
        // the worm: glow under, body segments fading toward the tail
        if (!dead || Math.floor(t * 8) % 2) {
          g.globalAlpha = 0.18;
          g.fillStyle = "#4dff7a";
          for (const s of worm) g.fillRect(ox + s[0] * cell - 3, oy + s[1] * cell - 3, cell + 6, cell + 6);
          g.globalAlpha = 1;
          worm.forEach((s, i) => {
            const x = ox + s[0] * cell, y = oy + s[1] * cell;
            const shade = i === 0 ? "#b0ffc0" : i % 2 ? "#4dff7a" : "#2ad85a";
            g.fillStyle = shade;
            g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            if (i === 0) {
              // eyes look the way it's heading
              const e = Math.max(2, Math.floor(cell / 5));
              const cx = x + cell / 2 + dir[0] * cell * 0.18, cy = y + cell / 2 + dir[1] * cell * 0.18;
              const px = dir[1] !== 0 ? cell * 0.22 : 0, py = dir[0] !== 0 ? cell * 0.22 : 0;
              g.fillStyle = "#000";
              g.fillRect(cx - px - e / 2, cy - py - e / 2, e, e);
              g.fillRect(cx + px - e / 2, cy + py - e / 2, e, e);
            }
          });
        }
        fx.draw(g);
        Kit.text(g, "LV " + level, W - ox - 6, oy + 10, 8, "#4dff7a", "right");
        if (!started && Math.floor(t * 2) % 2 === 0) Kit.text(g, "SWIPE TO GO", W / 2, H * 0.35, 12, "#fff", "center", "#4dff7a");
        banner.draw(g, W, H);
      }

      // Swipe: each time the finger travels far enough, that's a turn. Keeps working without lifting.
      function down(x, y) { swipe = { x, y }; }
      function move(x, y) {
        if (!swipe) return;
        const dx = x - swipe.x, dy = y - swipe.y;
        const min = Math.max(16, cell * 0.6);
        if (Math.abs(dx) < min && Math.abs(dy) < min) return;
        const nd = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
        turnTo(nd);
        swipe = { x, y };
      }
      // A turn from a swipe, the joystick or a button: the first one starts the worm.
      function turnTo(nd) {
        if (!started) {
          started = true;
          if (nd[0] !== -dir[0] || nd[1] !== -dir[1]) dir = nd; // the first swipe also picks the way
          Sound.play("move");
          return;
        }
        const lastQueued = queue.length ? queue[queue.length - 1] : dir;
        if (nd !== lastQueued && queue.length < 2) { queue.push(nd); Sound.play("move"); }
      }
      // Arcade mode: joystick turns to that direction; the buttons turn left or right of the way you're heading
      function arcade(ev) {
        if (ev.type === "dir" && ev.dir) turnTo(DIRS[ev.dir]);
        if (ev.type === "down") {
          const cur = queue.length ? queue[queue.length - 1] : dir;
          const left = [cur[1], -cur[0]], right = [-cur[1], cur[0]];
          const pick = v => Object.values(DIRS).find(d => d[0] === v[0] && d[1] === v[1]);
          turnTo(pick(ev.id === "a" ? left : right));
        }
      }
      function up() { swipe = null; }
      // The field keeps its size mid-game (so the worm never ends up outside it); it just re-centres.
      function resize(w, h) {
        W = w; H = h;
        ox = Math.floor((W - cell * COLS) / 2);
        oy = Math.max(0, Math.floor((H - cell * rows) / 2));
      }

      // A read-out of the game's state, used by the automatic tests.
      const state = () => ({ started, level, stepEvery, eaten, dead, cols: COLS, rows, worm, spark, rocks, dir, queued: queue.length,
        gold: gold && [gold.x, gold.y] });
      return { update, draw, down, move, up, arcade, resize, state };
    },
  });
})();
