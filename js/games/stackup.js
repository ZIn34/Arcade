// STACK UP — a block slides back and forth above your tower. Tap to drop it: whatever hangs over the
// edge is sliced off, so the next block is smaller. Land it dead-on for a PERFECT and the block grows
// back a little. The blocks slide faster the higher you build. Miss the tower completely and it's over.
// Tap anywhere to drop. In Arcade mode: press DROP.
(() => {
  Sound.defineSong("stackup", {
    bpm: 108,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "D3 . . A2 . . D3 .  B2 . . F#2 . . B2 .  G2 . . D3 . . G2 .  A2 . . E3 . . A2 .") },
      { type: "square", vol: 0.07, notes: Sound.notes(
        "F#5 - A5 - D6 - A5 -  F#5 - D5 - B4 - D5 -  G5 - B5 - D6 - B5 -  A5 - - - E5 - - -") },
      { drum: true, vol: 0.12, notes: Sound.notes("k . h . s . h .") },
    ],
  });

  const COLORS = ["#ff3c50", "#ff8a3c", "#ffd63c", "#4dff7a", "#3cf0ff", "#2060ff", "#c04cff", "#ff3cc8"];

  Arcade.addGame("stackup", {
    music: "stackup",
    deck: { stick: false, buttons: [{ id: "a", label: "DROP", color: "#ffd63c" }] },
    howTo: [
      "TAP TO DROP THE SLIDING BLOCK",
      "OVERHANGS ARE SLICED OFF",
      "LAND IT DEAD ON FOR A PERFECT",
      "IT SLIDES FASTER AS YOU BUILD",
      "MISS THE TOWER AND IT'S OVER",
    ],
    arcadeHowTo: [
      "DROP: DROP THE SLIDING BLOCK",
      "OVERHANGS ARE SLICED OFF",
      "LAND IT DEAD ON FOR A PERFECT",
      "IT SLIDES FASTER AS YOU BUILD",
      "MISS THE TOWER AND IT'S OVER",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const BH = 26;                       // block height
      const fx = Kit.particles(), banner = Kit.banner();
      const startW = Math.round(W * 0.55);
      let tower = [{ x: (W - startW) / 2, w: startW, color: COLORS[0] }];
      let cur = null, falling = [], floors = 0, perfects = 0, streak = 0, t = 0, over = false, overT = 0, camY = 0, camTarget = 0;

      const speed = () => Math.min(W * 1.9, W * (0.55 + floors * 0.045)); // px per second
      const groundY = () => H - 70;
      const topY = () => groundY() - tower.length * BH;   // screen y of the next block, before camera

      function next() {
        const top = tower[tower.length - 1];
        const fromLeft = tower.length % 2 === 0;
        cur = { x: fromLeft ? -top.w : W, w: top.w, dir: fromLeft ? 1 : -1, color: COLORS[tower.length % COLORS.length] };
      }
      next();

      function drop() {
        if (!cur || over) return;
        const top = tower[tower.length - 1];
        const left = Math.max(cur.x, top.x), right = Math.min(cur.x + cur.w, top.x + top.w);
        const overlap = right - left;
        const y = topY();
        if (overlap <= 0) {
          // missed: the whole block tumbles
          falling.push({ x: cur.x, y, w: cur.w, vy: 0, vx: cur.dir * 60, color: cur.color, rot: 0 });
          cur = null;
          over = true; overT = 1.4;
          Sound.play("lose");
          banner.show("MISSED!", floors + " FLOORS", "#fff", "#ff3c50", 1.4);
          return;
        }
        const off = Math.abs(cur.x - top.x);
        let block;
        if (off <= 4) {
          // PERFECT: snaps into place, and a little width comes back
          streak++; perfects++;
          const grow = Math.min(W * 0.7, top.w + (streak >= 3 ? 10 : 4));
          block = { x: top.x - (grow - top.w) / 2, w: grow, color: cur.color };
          block.x = Kit.clamp(block.x, 0, W - block.w);
          host.addScore(25 + streak * 5);
          Sound.tone(Sound.N(72 + Math.min(12, streak * 2)), 0.15, { vol: 0.2 });
          Sound.tone(Sound.N(79 + Math.min(12, streak * 2)), 0.2, { vol: 0.15, delay: 0.06 });
          banner.show("PERFECT!", streak > 1 ? "x" + streak : "", "#fff", "#ffd63c", 0.6);
          fx.burst(block.x + block.w / 2, y + BH / 2, "#fff", 16, 200, 0.5, 3);
        } else {
          streak = 0;
          block = { x: left, w: overlap, color: cur.color };
          // the sliced-off piece falls away
          const cutX = cur.x < top.x ? cur.x : right;
          falling.push({ x: cutX, y, w: cur.w - overlap, vy: 0, vx: cur.dir * 40, color: cur.color, rot: 0 });
          Sound.tone(260, 0.1, { vol: 0.2, type: "triangle" });
          Sound.noise(0.08, { vol: 0.12, freq: 2500 });
        }
        tower.push(block);
        floors++;
        host.addScore(10);
        if (floors % 10 === 0) { banner.show(floors + " FLOORS!", "FASTER!", "#fff", "#3cf0ff", 1); Sound.play("bonus"); host.tempo = Math.min(1.4, 1 + floors * 0.008); Sound.setTempo(host.tempo); }
        // the camera rises so the top of the tower stays in the middle of the screen
        camTarget = Math.max(0, tower.length * BH - (groundY() - H * 0.45));
        next();
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        camY += (camTarget - camY) * Math.min(1, dt * 6);
        for (const f of falling) { f.vy += 1400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.vx * 0.0006 * dt * 60; }
        falling = falling.filter(f => f.y < H + camY + 200);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (cur) {
          cur.x += cur.dir * speed() * dt;
          // bounce at the edges
          if (cur.x < -cur.w * 0.6) { cur.x = -cur.w * 0.6; cur.dir = 1; }
          if (cur.x > W - cur.w * 0.4) { cur.x = W - cur.w * 0.4; cur.dir = -1; }
        }
      }

      function drawBlock(g, x, y, w, color) {
        g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), BH);
        g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(Math.round(x), Math.round(y), Math.round(w), 4);
        g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(Math.round(x), Math.round(y) + BH - 4, Math.round(w), 4);
        // windows
        g.fillStyle = "rgba(0,0,0,.25)";
        for (let wx = x + 8; wx < x + w - 10; wx += 16) g.fillRect(Math.round(wx), Math.round(y) + 9, 6, 8);
      }

      function draw(g) {
        // the sky darkens to space as you climb
        const k = Math.min(1, floors / 60);
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, k > 0.6 ? "#02000a" : k > 0.3 ? "#0a0630" : "#1a3a8a");
        grad.addColorStop(1, k > 0.6 ? "#0a0420" : k > 0.3 ? "#2a1060" : "#5a7ad0");
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        if (k > 0.3) for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? "#667" : "#fff"; g.fillRect((i * 97) % W, (i * 61 + camY * 0.2) % H, 2, 2); }
        g.save();
        g.translate(0, camY);
        // the ground
        g.fillStyle = "#1a5a22"; g.fillRect(0, groundY(), W, 200);
        g.fillStyle = "#2a8a3a"; g.fillRect(0, groundY(), W, 6);
        tower.forEach((b, i) => drawBlock(g, b.x, groundY() - (i + 1) * BH, b.w, b.color));
        if (cur) {
          drawBlock(g, cur.x, topY() - BH, cur.w, cur.color);
          // a guide line showing where the top edge is
          g.fillStyle = "rgba(255,255,255,.18)";
          const top = tower[tower.length - 1];
          g.fillRect(top.x, topY() - BH, 2, BH); g.fillRect(top.x + top.w - 2, topY() - BH, 2, BH);
        }
        for (const f of falling) {
          g.save(); g.translate(f.x + f.w / 2, f.y + BH / 2); g.rotate(f.rot);
          drawBlock(g, -f.w / 2, -BH / 2, f.w, f.color); g.restore();
        }
        g.restore();
        fx.draw(g);
        Kit.text(g, floors + " FLOORS", W / 2, 20, 10, "#fff", "center", "#ffd63c");
        if (!floors && !over && Math.floor(t * 2) % 2 === 0) Kit.text(g, host.arcade ? "PRESS DROP" : "TAP TO DROP", W / 2, H * 0.3, 12, "#fff", "center", "#ff3cc8");
        banner.draw(g, W, H);
      }

      function down() { drop(); }
      function arcade(ev) { if (ev.type === "down" && ev.id === "a") drop(); }

      const state = () => ({ floors, perfects, over, speed: speed(), cur: cur && { x: cur.x, w: cur.w, dir: cur.dir }, top: { ...tower[tower.length - 1] }, width: tower[tower.length - 1].w });
      return { update, draw, down, arcade, state, resize(w, h) { W = w; H = h; } };
    },
  });
})();
