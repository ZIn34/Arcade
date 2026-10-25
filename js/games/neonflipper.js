// NEON FLIPPER — a glowing pinball table. Keep the ball in play with the two flippers: hit the round
// bumpers for points, light all three targets at the top for a bonus, and the slingshots above the
// flippers kick the ball back up. Every few thousand points, or 45 seconds, the table tilts steeper
// (the ball falls faster) and later the bumpers start to slide about. Three balls.
// Hold the left or right side of the screen to flip. In Arcade mode: the LEFT and RIGHT buttons.
(() => {
  Sound.defineSong("neonflipper", {
    bpm: 120,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "E2 . E3 . B2 . E3 .  A2 . A3 . E3 . A3 .  B2 . B3 . F#3 . B3 .  E2 . E3 . G#2 . B2 .") },
      { type: "square", vol: 0.07, notes: Sound.notes(
        "B4 . E5 . G#5 . B5 .  C#6 . A5 . E5 . C#5 .  D#5 . F#5 . B5 . A5 .  G#5 . . . E5 . . .") },
      { drum: true, vol: 0.14, notes: Sound.notes("k . h . s . h k") },
    ],
  });

  Arcade.addGame("neonflipper", {
    music: "neonflipper",
    deck: { stick: false, buttons: [{ id: "l", label: "LEFT", color: "#ff3cc8" }, { id: "r", label: "RIGHT", color: "#3cf0ff" }] },
    howTo: [
      "HOLD THE LEFT SIDE: LEFT FLIPPER",
      "HOLD THE RIGHT SIDE: RIGHT FLIPPER",
      "HIT BUMPERS FOR POINTS",
      "LIGHT ALL 3 TARGETS FOR A BONUS",
      "3 BALLS. THE TABLE GETS STEEPER",
    ],
    arcadeHowTo: [
      "LEFT: LEFT FLIPPER",
      "RIGHT: RIGHT FLIPPER",
      "HIT BUMPERS FOR POINTS",
      "LIGHT ALL 3 TARGETS FOR A BONUS",
      "3 BALLS. THE TABLE GETS STEEPER",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const fx = Kit.particles(), banner = Kit.banner();
      const R = 8;
      let walls, slings, bumpers, targets, flippers, L;
      let ball = null, balls = 3, t = 0, over = false, overT = 0, level = 1, launchT = 1, nextLevelAt = 3000, playT = 0;
      const touches = new Map();
      const pressed = { l: false, r: false };

      function build() {
        L = W * 0.21;
        const fy = H - 92;
        flippers = [
          { side: "l", px: W * 0.29, py: fy, rest: 0.52, up: -0.48, a: 0.52, w: 0 },
          { side: "r", px: W * 0.71, py: fy, rest: Math.PI - 0.52, up: Math.PI + 0.48, a: Math.PI - 0.52, w: 0 },
        ];
        const top = 22;
        walls = [
          // the arched top
          [8, 90, W * 0.12, top + 30], [W * 0.12, top + 30, W * 0.3, top + 6], [W * 0.3, top + 6, W * 0.7, top + 6],
          [W * 0.7, top + 6, W * 0.88, top + 30], [W * 0.88, top + 30, W - 8, 90],
          // the sides
          [8, 90, 8, H - 210], [W - 8, 90, W - 8, H - 210],
          // the lanes down into the flippers
          [8, H - 210, flippers[0].px - 6, flippers[0].py - 8], [W - 8, H - 210, flippers[1].px + 6, flippers[1].py - 8],
        ];
        slings = [
          [W * 0.14, H - 300, W * 0.25, H - 196], [W * 0.86, H - 300, W * 0.75, H - 196],
        ];
        bumpers = [
          { x: W * 0.3, y: H * 0.27, r: 24, flash: 0, vx: 0, home: W * 0.3 },
          { x: W * 0.7, y: H * 0.27, r: 24, flash: 0, vx: 0, home: W * 0.7 },
          { x: W * 0.5, y: H * 0.4, r: 26, flash: 0, vx: 0, home: W * 0.5 },
        ];
        targets = [0.36, 0.5, 0.64].map(k => ({ x: W * k, y: H * 0.13, w: 30, lit: false, flash: 0 }));
      }
      build();

      const gravity = () => 820 * Math.pow(1.1, Math.min(level, 9) - 1); // capped, so it stays playable

      function serve() {
        ball = { x: W - 34, y: 110, vx: -Kit.rand(140, 220), vy: 40 };
        Sound.play("jump");
      }

      // Pushes the ball out of a line segment and bounces it. `surface` gives the speed of a moving
      // surface at a point (for the flippers); `kick` adds a push straight out (slingshots).
      function collide(ax, ay, bx, by, rest, surface, kick) {
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        let k = ((ball.x - ax) * dx + (ball.y - ay) * dy) / len2;
        k = Kit.clamp(k, 0, 1);
        const px = ax + dx * k, py = ay + dy * k;
        let nx = ball.x - px, ny = ball.y - py;
        const d = Math.hypot(nx, ny);
        if (d >= R || d === 0) return false;
        nx /= d; ny /= d;
        ball.x = px + nx * R; ball.y = py + ny * R;
        const sv = surface ? surface(px, py) : { x: 0, y: 0 };
        const rvx = ball.vx - sv.x, rvy = ball.vy - sv.y;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          ball.vx -= (1 + rest) * vn * nx; ball.vy -= (1 + rest) * vn * ny;
          if (kick) { ball.vx += nx * kick; ball.vy += ny * kick; }
          return true;
        }
        return false;
      }

      function step(dt) {
        // flippers swing toward up while held, back down when let go
        for (const f of flippers) {
          const want = pressed[f.side] ? f.up : f.rest;
          const old = f.a, sp = 22 * dt;
          if (f.side === "l") f.a = want < f.a ? Math.max(want, f.a - sp) : Math.min(want, f.a + sp);
          else f.a = want > f.a ? Math.min(want, f.a + sp) : Math.max(want, f.a - sp);
          f.w = (f.a - old) / dt;
        }
        if (!ball) return;
        ball.vy += gravity() * dt;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        for (const w of walls) collide(w[0], w[1], w[2], w[3], 0.5);
        for (const s of slings) if (collide(s[0], s[1], s[2], s[3], 0.6, null, 260)) { host.addScore(10); Sound.play("bounce"); }
        for (const f of flippers) {
          const ex = f.px + Math.cos(f.a) * L, ey = f.py + Math.sin(f.a) * L;
          // the flipper's surface moves with it: points further out move faster
          collide(f.px, f.py, ex, ey, 0.35, (x, y) => ({ x: -f.w * (y - f.py), y: f.w * (x - f.px) }));
        }
        for (const b of bumpers) {
          const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy);
          if (d < b.r + R && d > 0) {
            const nx = dx / d, ny = dy / d;
            ball.x = b.x + nx * (b.r + R); ball.y = b.y + ny * (b.r + R);
            const vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) { ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny; }
            const sp = Math.max(520, Math.hypot(ball.vx, ball.vy) * 1.05);
            const s2 = sp / Math.hypot(ball.vx, ball.vy);
            ball.vx *= s2; ball.vy *= s2;
            b.flash = 0.15;
            host.addScore(100 * level);
            Sound.tone(Sound.N(76 + bumpers.indexOf(b) * 4), 0.08, { vol: 0.2 });
            fx.burst(b.x + nx * b.r, b.y + ny * b.r, "#ff3cc8", 6, 140, 0.3, 3);
          }
        }
        for (const tg of targets) {
          if (!tg.lit && ball.y - R < tg.y + 6 && ball.y + R > tg.y - 6 && Math.abs(ball.x - tg.x) < tg.w / 2 + R) {
            tg.lit = true; tg.flash = 0.3;
            ball.vy = Math.abs(ball.vy) * 0.8;
            host.addScore(250 * level);
            Sound.play("point");
            if (targets.every(x => x.lit)) {
              host.addScore(1000 * level);
              banner.show("TARGETS!", "+" + 1000 * level, "#fff", "#3cf0ff", 1);
              Sound.play("bonus");
              setTimeout(() => targets.forEach(x => { x.lit = false; }), 600);
            }
          }
        }
        // speed limit, so it never tunnels through a wall
        const sp = Math.hypot(ball.vx, ball.vy), max = 1300;
        if (sp > max) { ball.vx *= max / sp; ball.vy *= max / sp; }
        if (ball.y > H + 30) {
          ball = null; balls--;
          Sound.play("lose");
          if (balls <= 0) { over = true; overT = 1; banner.show("TILT!", "NO BALLS LEFT", "#fff", "#ff3c50", 1.2); }
          else { banner.show("BALL LOST", balls + (balls === 1 ? " BALL LEFT" : " BALLS LEFT"), "#fff", "#ff3c50", 1); launchT = 1.2; }
        }
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        for (const b of bumpers) b.flash = Math.max(0, b.flash - dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (!ball) { launchT -= dt; if (launchT <= 0) serve(); }
        // later on the bumpers slide about
        if (level >= 3) for (const b of bumpers) { b.x = b.home + Math.sin(t * (0.6 + level * 0.1) + b.home) * W * 0.08; }
        const n = 8;
        for (let i = 0; i < n; i++) step(dt / n);
        // the table gets steeper with your score, and anyway every 45 seconds of play
        if (ball) playT += dt;
        if (host.score >= nextLevelAt || playT >= 45) {
          level++; nextLevelAt = Math.max(nextLevelAt, host.score) + 3000 * level; playT = 0;
          banner.show("LEVEL " + level, "STEEPER TABLE!", "#fff", "#ff3cc8", 1.2);
          Sound.play("power");
          host.tempo = Math.min(1.35, 1 + (level - 1) * 0.06);
          Sound.setTempo(host.tempo);
        }
      }

      function line(g, ax, ay, bx, by, color, w = 3) {
        g.strokeStyle = color; g.lineWidth = w + 4; g.globalAlpha = 0.25;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.globalAlpha = 1; g.lineWidth = w;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      }

      function draw(g) {
        g.fillStyle = "#07020f"; g.fillRect(0, 0, W, H);
        // faint grid on the playfield
        g.fillStyle = "#120624";
        for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 1);
        for (const w of walls) line(g, w[0], w[1], w[2], w[3], "#3cf0ff");
        for (const s of slings) line(g, s[0], s[1], s[2], s[3], "#ffd63c", 4);
        for (const b of bumpers) {
          g.fillStyle = b.flash ? "#fff" : "#ff3cc8";
          g.globalAlpha = 0.25; g.beginPath(); g.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
          g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#2a0626"; g.beginPath(); g.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); g.fill();
          Kit.text(g, String(100 * level), b.x, b.y + 1, 7, "#fff");
        }
        for (const tg of targets) {
          g.fillStyle = tg.lit ? "#ffd63c" : "#4a3a10";
          g.fillRect(tg.x - tg.w / 2, tg.y - 5, tg.w, 10);
        }
        for (const f of flippers) {
          const ex = f.px + Math.cos(f.a) * L, ey = f.py + Math.sin(f.a) * L;
          line(g, f.px, f.py, ex, ey, pressed[f.side] ? "#ffffff" : f.side === "l" ? "#ff3cc8" : "#3cf0ff", 9);
          g.fillStyle = "#fff"; g.beginPath(); g.arc(f.px, f.py, 6, 0, Math.PI * 2); g.fill();
        }
        if (ball) {
          g.fillStyle = "#fff"; g.globalAlpha = 0.3; g.beginPath(); g.arc(ball.x, ball.y, R + 4, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
          g.beginPath(); g.arc(ball.x, ball.y, R, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#aac"; g.fillRect(ball.x - 3, ball.y - 4, 3, 3);
        }
        fx.draw(g);
        for (let i = 0; i < balls; i++) { g.fillStyle = "#fff"; g.beginPath(); g.arc(W - 16 - i * 16, H - 16, 5, 0, Math.PI * 2); g.fill(); }
        Kit.text(g, "LEVEL " + level, 12, H - 16, 8, "#ff3cc8", "left");
        banner.draw(g, W, H);
      }

      // touch: each finger holds the flipper on its side of the screen
      function refresh() {
        pressed.l = false; pressed.r = false;
        for (const side of touches.values()) pressed[side] = true;
        if (host.arcade) { if (host.pad.held.l) pressed.l = true; if (host.pad.held.r) pressed.r = true; }
      }
      function down(x, y, id) { touches.set(id, x < W / 2 ? "l" : "r"); refresh(); Sound.tone(180, 0.04, { vol: 0.1, type: "triangle" }); }
      function up(x, y, id) { touches.delete(id); refresh(); }
      function arcade(ev) { refresh(); if (ev.type === "down") Sound.tone(180, 0.04, { vol: 0.1, type: "triangle" }); }

      const state = () => ({ balls, level, over, gravity: gravity(), ball: ball && { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
        flippers: flippers.map(f => ({ side: f.side, px: f.px, py: f.py, a: f.a, len: L })), pressed: { ...pressed }, bumpersMoving: level >= 3 });
      return { update, draw, down, up, arcade, state, resize(w, h) { W = w; H = h; build(); } };
    },
  });
})();
