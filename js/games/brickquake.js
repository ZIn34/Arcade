// BRICK QUAKE — smash every brick. Every so often the ground shakes and the whole wall drops a row,
// and the quakes come faster each level. If the wall reaches your paddle, it's over.
// Drag anywhere to slide the paddle; lift your finger (or tap) to launch the ball.
(() => {
  Sound.defineSong("brickquake", {
    bpm: 128,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "A2 . A2 A3 . A2 G2 .  A2 . A2 A3 . C3 D3 .  F2 . F2 F3 . F2 E2 .  G2 . G2 G3 . B2 D3 .") },
      { type: "square", vol: 0.09, notes: Sound.notes(
        "A4 . C5 . E5 . C5 D5  . C5 . A4 . G4 . .  F4 . A4 . C5 . A4 B4  . G4 . B4 . D5 . .") },
      { drum: true, vol: 0.18, notes: Sound.notes("k . h k s . h .  k . h k s . h s") },
    ],
  });

  const ROW_COLORS = ["#ff3c50", "#ff8a3c", "#ffd63c", "#4dff7a", "#3cf0ff", "#2060ff", "#c04cff", "#ff3cc8"];
  const CAPS = {
    wide: { letter: "W", color: "#3cf0ff" },
    multi: { letter: "M", color: "#ff3cc8" },
    slow: { letter: "S", color: "#4dff7a" },
    life: { letter: "+", color: "#ffd63c" },
  };

  Arcade.addGame("brickquake", {
    music: "brickquake",
    deck: { stick: true, buttons: [{ id: "a", label: "LAUNCH", color: "#ff8a3c" }] },
    arcadeHowTo: [
      "JOYSTICK: SLIDE THE PADDLE",
      "LAUNCH: SEND THE BALL",
      "BREAK EVERY BRICK",
      "QUAKES DROP THE WALL LOWER",
      "CATCH W, M, S AND + CAPSULES",
    ],
    howTo: [
      "DRAG TO SLIDE THE PADDLE",
      "LET GO TO LAUNCH THE BALL",
      "BREAK EVERY BRICK",
      "QUAKES DROP THE WALL LOWER",
      "CATCH W, M, S AND + CAPSULES",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 8;
      const fx = Kit.particles(), banner = Kit.banner();
      let level = 0, lives = 3, t = 0, shake = 0, over = false, overT = 0;
      let bricks = [], balls = [], caps = [];
      let bw, bh, top, quakeT, quakeEvery, baseSpeed;
      const pad = { w: 0, h: 12, x: 0, y: 0, wideT: 0 };
      let slowT = 0, held = false, aim = null;

      function layoutPad() {
        pad.baseW = Math.round(W * 0.22);
        pad.w = pad.wideT > 0 ? pad.baseW * 1.5 : pad.baseW;
        pad.y = H - 56;
        pad.x = Kit.clamp(pad.x || (W - pad.w) / 2, 0, W - pad.w);
      }

      function newLevel() {
        level++;
        bw = W / COLS; bh = Math.max(14, Math.round(H / 34));
        top = 40;
        bricks = [];
        const rows = Math.min(8, 3 + level);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < COLS; c++) {
            // later levels leave gaps in a few patterns so each one looks different
            if (level > 1 && ((level % 3 === 2 && (r + c) % 5 === 0) || (level % 3 === 0 && c % 4 === 1 && r % 2 === 0))) continue;
            const tough = level >= 2 && r < Math.min(3, level - 1);
            bricks.push({ c, r, hp: tough ? 2 : 1, color: ROW_COLORS[r % ROW_COLORS.length], cap: Math.random() < 0.1 ? Kit.pick(Object.keys(CAPS)) : null });
          }
        }
        quakeEvery = Math.max(7, 22 - level * 2.5);
        quakeT = quakeEvery;
        baseSpeed = H * (0.62 + Math.min(0.5, (level - 1) * 0.07));
        caps = [];
        resetBall();
        banner.show("LEVEL " + level, level === 1 ? (host.arcade ? "PRESS LAUNCH" : "LET GO TO LAUNCH") : "QUAKES EVERY " + Math.round(quakeEvery) + "S", "#fff", "#ff8a3c", 1.8);
        host.tempo = Math.min(1.4, 1 + (level - 1) * 0.06);
        Sound.setTempo(host.tempo);
      }

      function resetBall() {
        layoutPad();
        balls = [{ x: pad.x + pad.w / 2, y: pad.y - 6, vx: 0, vy: 0, r: 5, stuck: true }];
      }

      const brickRect = b => ({ x: b.c * bw + 2, y: top + b.r * bh + 2, w: bw - 4, h: bh - 4 });

      function launch() {
        for (const b of balls) if (b.stuck) {
          b.stuck = false;
          const a = -Math.PI / 2 + Kit.rand(-0.35, 0.35);
          b.vx = Math.cos(a) * baseSpeed; b.vy = Math.sin(a) * baseSpeed;
          Sound.play("jump");
        }
      }

      function quake() {
        shake = 0.6;
        for (const b of bricks) b.r++;
        // the longer a level lasts, the closer together the quakes come
        quakeEvery = Math.max(5, quakeEvery - 1);
        Sound.noise(0.6, { vol: 0.35, freq: 400, slide: 60 });
        Sound.tone(70, 0.5, { vol: 0.3, type: "triangle", slide: 40 });
        banner.show("QUAKE!", "", "#fff", "#ff3c50", 0.8);
        // a rumble also nudges every free ball
        for (const b of balls) if (!b.stuck) b.vx += Kit.rand(-40, 40);
      }

      function loseBall() {
        lives--;
        Sound.play("lose");
        if (lives <= 0) { over = true; overT = 1; return; }
        pad.wideT = 0; slowT = 0;
        resetBall();
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        shake = Math.max(0, shake - dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        pad.wideT = Math.max(0, pad.wideT - dt);
        slowT = Math.max(0, slowT - dt);
        const targetW = pad.wideT > 0 ? pad.baseW * 1.5 : pad.baseW;
        pad.w += (targetW - pad.w) * Math.min(1, dt * 8);
        if (aim != null) pad.x = Kit.clamp(aim - pad.w / 2, 0, W - pad.w);
        // Arcade mode: the joystick slides the paddle
        if (host.arcade && host.pad.x) pad.x = Kit.clamp(pad.x + host.pad.x * 720 * dt, 0, W - pad.w);

        if (!balls.some(b => b.stuck)) {
          quakeT -= dt;
          if (quakeT <= 0) { quake(); quakeT = quakeEvery; }
        }
        // The wall reaching the paddle ends the game.
        if (bricks.some(b => top + (b.r + 1) * bh > pad.y - 4)) {
          Sound.play("boom");
          shake = 0.8;
          over = true; overT = 1.2;
          return;
        }

        const speedK = slowT > 0 ? 0.65 : 1;
        // small steps so a fast ball can't pass through a brick
        const steps = Math.ceil((baseSpeed * dt) / 4);
        const sdt = dt / steps;
        for (let s = 0; s < steps; s++) {
          for (const b of balls) {
            if (b.stuck) { b.x = pad.x + pad.w / 2; b.y = pad.y - b.r - 1; continue; }
            b.x += b.vx * sdt * speedK; b.y += b.vy * sdt * speedK;
            if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); Sound.play("bounce"); }
            if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); Sound.play("bounce"); }
            if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); Sound.play("bounce"); }
            // paddle: where it lands sets the angle out
            if (b.vy > 0 && b.y + b.r >= pad.y && b.y + b.r <= pad.y + pad.h + 6 && b.x > pad.x - b.r && b.x < pad.x + pad.w + b.r) {
              const off = Kit.clamp((b.x - (pad.x + pad.w / 2)) / (pad.w / 2), -1, 1);
              // a tiny random nudge stops the ball settling into a loop that never reaches the last bricks
              const a = -Math.PI / 2 + Kit.clamp(off * 1.05 + Kit.rand(-0.06, 0.06), -1.15, 1.15);
              const sp = Math.min(baseSpeed * 1.6, Math.hypot(b.vx, b.vy) * 1.01);
              b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
              b.y = pad.y - b.r;
              Sound.tone(Sound.N(67), 0.05, { vol: 0.2 });
            }
            // bricks
            for (const br of bricks) {
              if (br.hp <= 0) continue;
              const r = brickRect(br);
              const nx = Kit.clamp(b.x, r.x, r.x + r.w), ny = Kit.clamp(b.y, r.y, r.y + r.h);
              const dx = b.x - nx, dy = b.y - ny;
              if (dx * dx + dy * dy <= b.r * b.r) {
                if (Math.abs(dx) > Math.abs(dy)) b.vx = Math.sign(dx || -b.vx) * Math.abs(b.vx);
                else b.vy = Math.sign(dy || -b.vy) * Math.abs(b.vy);
                br.hp--;
                if (br.hp <= 0) {
                  host.addScore(10 * level + (br.tough ? 10 : 0));
                  fx.burst(r.x + r.w / 2, r.y + r.h / 2, br.color, 10, 140, 0.5, 3);
                  Sound.tone(Sound.N(72 + (br.r % 5) * 2), 0.06, { vol: 0.18 });
                  if (br.cap) caps.push({ kind: br.cap, x: r.x + r.w / 2 - 12, y: r.y, w: 24, h: 12 });
                } else {
                  br.tough = true;
                  Sound.play("bounce");
                }
                break;
              }
            }
          }
          bricks = bricks.filter(b => b.hp > 0);
        }
        const lost = balls.filter(b => b.y > H + 10);
        balls = balls.filter(b => b.y <= H + 10);
        if (lost.length && !balls.length) loseBall();

        for (const c of caps) c.y += H * 0.22 * dt;
        for (const c of caps) {
          if (c.y + c.h > pad.y && c.y < pad.y + pad.h && c.x + c.w > pad.x && c.x < pad.x + pad.w) {
            c.y = H + 50;
            Sound.play("power");
            host.addScore(25);
            if (c.kind === "wide") pad.wideT = 15;
            if (c.kind === "slow") slowT = 10;
            if (c.kind === "life") lives = Math.min(5, lives + 1);
            if (c.kind === "multi") {
              const src = balls.find(b => !b.stuck) || balls[0];
              if (src) for (const d of [-0.5, 0.5]) {
                const sp = Math.hypot(src.vx, src.vy) || baseSpeed;
                const a = Math.atan2(src.vy || -1, src.vx) + d;
                balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: src.r, stuck: false });
              }
            }
          }
        }
        caps = caps.filter(c => c.y < H + 20);

        if (!bricks.length) {
          host.addScore(200 * level);
          Sound.play("bonus");
          newLevel();
        }
      }

      function draw(g) {
        g.save();
        if (shake > 0) g.translate(Kit.rand(-6, 6) * shake, Kit.rand(-3, 3) * shake);
        g.fillStyle = "#0a0402";
        g.fillRect(-10, -10, W + 20, H + 20);
        // danger line: where the wall must not reach
        g.fillStyle = "#ff3c50";
        g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4);
        for (let x = 0; x < W; x += 12) g.fillRect(x, pad.y - 10, 6, 2);
        g.globalAlpha = 1;

        for (const br of bricks) {
          const r = brickRect(br);
          g.fillStyle = br.color;
          g.globalAlpha = br.hp > 1 ? 1 : br.tough ? 0.55 : 0.9;
          g.fillRect(r.x, r.y, r.w, r.h);
          g.globalAlpha = 1;
          g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(r.x, r.y, r.w, 2);
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(r.x, r.y + r.h - 2, r.w, 2);
          if (br.hp > 1) { g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(r.x + 3, r.y + 3, 3, 3); g.fillRect(r.x + r.w - 6, r.y + 3, 3, 3); }
          if (br.cap) { g.fillStyle = "#fff"; g.fillRect(r.x + r.w / 2 - 2, r.y + r.h / 2 - 2, 4, 4); }
        }
        for (const c of caps) {
          const C = CAPS[c.kind];
          g.fillStyle = C.color;
          g.fillRect(c.x, c.y, c.w, c.h);
          Kit.text(g, C.letter, c.x + c.w / 2, c.y + c.h / 2 + 1, 8, "#000");
        }
        // paddle
        g.fillStyle = "#ff8a3c";
        g.globalAlpha = 0.3; g.fillRect(pad.x - 3, pad.y - 3, pad.w + 6, pad.h + 6); g.globalAlpha = 1;
        g.fillRect(pad.x, pad.y, pad.w, pad.h);
        g.fillStyle = "#ffd63c"; g.fillRect(pad.x + 4, pad.y + 2, pad.w - 8, 3);
        g.fillStyle = "#3cf0ff"; g.fillRect(pad.x, pad.y, 6, pad.h); g.fillRect(pad.x + pad.w - 6, pad.y, 6, pad.h);
        // balls
        for (const b of balls) {
          g.fillStyle = "#fff";
          g.globalAlpha = 0.3; g.fillRect(b.x - b.r - 2, b.y - b.r - 2, b.r * 2 + 4, b.r * 2 + 4); g.globalAlpha = 1;
          g.fillRect(Math.round(b.x - b.r), Math.round(b.y - b.r), b.r * 2, b.r * 2);
        }
        fx.draw(g);
        g.restore();

        // quake meter and lives
        const frac = Kit.clamp(quakeT / quakeEvery, 0, 1);
        Kit.text(g, "QUAKE", 8, 16, 8, "#ff3c50", "left");
        g.fillStyle = "#331"; g.fillRect(56, 12, W - 140, 8);
        g.fillStyle = frac < 0.25 && Math.floor(t * 8) % 2 ? "#fff" : "#ff3c50";
        g.fillRect(56, 12, (W - 140) * frac, 8);
        Kit.text(g, "LV " + level, W - 8, 16, 8, "#ffd63c", "right");
        for (let i = 0; i < lives; i++) { g.fillStyle = "#ff8a3c"; g.fillRect(8 + i * 22, H - 16, 18, 6); }
        if (balls.some(b => b.stuck) && !over && Math.floor(t * 2) % 2) Kit.text(g, (host.arcade ? "PRESS LAUNCH" : "LET GO TO LAUNCH"), W / 2, pad.y + 36, 8, "#ddd");
        banner.draw(g, W, H);
      }

      function down(x) { held = true; aim = x; }
      function arcade(ev) { if (ev.type === "down" && ev.id === "a") launch(); }
      function move(x) { if (held) aim = x; }
      function up() { held = false; aim = null; launch(); }
      function resize(w, h) {
        W = w; H = h;
        bw = W / COLS;
        layoutPad();
      }

      layoutPad();
      newLevel();
      // A read-out of the game's state, used by the automatic tests.
      const state = () => ({ level, lives, quakeEvery, baseSpeed, bricks: bricks.length, over,
        lowestRow: Math.max(-1, ...bricks.map(b => b.r)),
        balls: balls.map(b => ({ x: b.x, y: b.y, vy: b.vy, stuck: b.stuck })), pad: { x: pad.x, w: pad.w, y: pad.y } });
      return { update, draw, down, move, up, arcade, resize, state };
    },
  });
})();
