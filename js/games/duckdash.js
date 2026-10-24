// DUCK DASH — help Mama Duck hop as far up the city as she can. Roads have cars and trucks, railway
// lines have fast trains (watch for the warning light), and canals are safe to swim but the current
// drags you and speedboats don't stop. Pick up lost ducklings: each one in your line boosts every
// step's points. Dawdle and the hawk overhead swoops.
// Tap to hop forward; swipe left, right or down to hop that way.
(() => {
  Sound.defineSong("duckdash", {
    bpm: 132,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "G2 . D3 . G2 . D3 .  C3 . G2 . C3 . G2 .  D3 . A2 . D3 . A2 .  G2 . D3 . G2 B2 D3 .") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "B4 . D5 . G5 . D5 .  E5 . C5 . G4 . C5 .  F#5 . D5 . A4 . D5 .  G5 . . . D5 . B4 .") },
      { drum: true, vol: 0.14, notes: Sound.notes("k . h . s . h h") },
    ],
  });

  const DUCK = [
    "...yyy....",
    "..yyyyy...",
    "..yykyyoo.",
    "..yyyyyooo",
    "...yyyy...",
    "yy.yyyy...",
    "yyyyyyyyy.",
    ".yyYYYYyy.",
    "..yyyyyy..",
    "...o..o...",
  ];
  const DUCK_PAL = { y: "#ffffff", Y: "#dddddd", k: "#000000", o: "#ff8a3c" };
  const CHICK = ["..yy..", ".yykyo", ".yyyy.", "yyyyy.", ".yyyy.", "..o.o."];
  const CHICK_PAL = { y: "#ffd63c", k: "#000", o: "#ff8a3c" };
  const CAR_COLORS = ["#ff3c50", "#3cf0ff", "#c04cff", "#4dff7a", "#ff8a3c", "#ff3cc8"];

  Arcade.addGame("duckdash", {
    music: "duckdash",
    howTo: [
      "TAP TO HOP FORWARD",
      "SWIPE LEFT, RIGHT OR DOWN TO HOP THAT WAY",
      "DODGE CARS, TRAINS AND BOATS",
      "WATER IS SAFE BUT THE CURRENT PULLS",
      "PICK UP DUCKLINGS FOR MORE POINTS",
      "KEEP MOVING OR THE HAWK SWOOPS",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 9;
      let C = Math.floor(W / COLS);
      let ox = Math.floor((W - C * COLS) / 2);
      const S = Math.max(2, Math.floor(C / 12));
      const duckImg = [Pixel.bake(DUCK, DUCK_PAL, S), Pixel.bake(DUCK, DUCK_PAL, S, true)];
      const chickImg = Pixel.bake(CHICK, CHICK_PAL, Math.max(2, S - 1));
      const fx = Kit.particles(), banner = Kit.banner();

      const lanes = [];   // lanes[row]
      let genRow = 0, segLeft = 0, segType = "grass";
      const duck = { col: 4, row: 1, x: 4, fromX: 4, fromRow: 1, hopT: 0, face: 0 };
      const HOP = 0.12;
      let queued = null, best = 1, camY = 0, lives = 3, invuln = 0, dead = 0, over = false, overT = 0, t = 0;
      let chicks = 0, followers = [], hawkWarn = 0, started = false;

      // difficulty grows with how far up you are
      const level = row => 1 + row / 45;

      function addLane() {
        const r = genRow++;
        if (r < 3) { lanes[r] = { type: "grass", bushes: new Set(), chick: -1 }; return; }
        if (segLeft <= 0) {
          const prev = segType;
          const opts = prev === "grass" ? ["road", "road", "water", "rail", "road"] : ["grass"];
          segType = Kit.pick(opts);
          segLeft = segType === "grass" ? Kit.irand(1, 2) : segType === "rail" ? Kit.irand(1, 2) : Kit.irand(2, Math.min(5, 2 + Math.floor(r / 30)));
        }
        segLeft--;
        const L = level(r);
        const dir = Math.random() < 0.5 ? -1 : 1;
        if (segType === "grass") {
          const bushes = new Set();
          const n = Kit.irand(0, Math.min(4, 1 + Math.floor(r / 40)));
          for (let i = 0; i < n; i++) bushes.add(Kit.irand(0, COLS - 1));
          bushes.delete(4);
          const chick = Math.random() < 0.18 ? Kit.pick([...Array(COLS).keys()].filter(c => !bushes.has(c))) : -1;
          lanes[r] = { type: "grass", bushes, chick };
        } else if (segType === "road") {
          const speed = Kit.rand(1.4, 2.6) * Math.min(2.4, L);
          const items = [];
          let x = Kit.rand(0, 3);
          while (x < COLS + 6) {
            const len = Math.random() < 0.25 ? 2 : 1;
            items.push({ x, len, color: Kit.pick(CAR_COLORS) });
            x += len + Kit.rand(Math.max(1.6, 3.6 - L * 0.7), Math.max(2.6, 6 - L));
          }
          lanes[r] = { type: "road", dir, speed, items, span: x };
        } else if (segType === "water") {
          const speed = Kit.rand(0.6, 1.2) * Math.min(2, L);
          const items = [];
          let x = Kit.rand(0, 4);
          while (x < COLS + 8) {
            items.push({ x, len: 2 });
            x += 2 + Kit.rand(Math.max(3, 6 - L), Math.max(5, 9 - L));
          }
          lanes[r] = { type: "water", dir, speed, items, span: x };
        } else {
          lanes[r] = { type: "rail", dir, speed: 20, train: null, timer: Kit.rand(1.5, 5) / Math.min(2, L), warn: 0, L };
        }
      }
      for (let i = 0; i < 40; i++) addLane();

      // where each item is right now (they loop round the lane)
      function itemX(lane, it) {
        const span = lane.span;
        let x = (it.x + lane.dir * lane.speed * t) % span;
        if (x < 0) x += span;
        return x - 3; // a little off-screen run-up on each side
      }

      function hazardAt(row, x) {
        const lane = lanes[row];
        if (!lane) return null;
        const a = x + 0.2, b = x + 0.8;
        if (lane.type === "road" || lane.type === "water") {
          for (const it of lane.items) {
            const ix = itemX(lane, it);
            if (b > ix + 0.05 && a < ix + it.len - 0.05) return lane.type === "road" ? "car" : "boat";
          }
        }
        if (lane.type === "rail" && lane.train) {
          const tx = lane.train.x;
          if (b > tx && a < tx + lane.train.len) return "train";
        }
        return null;
      }

      function hop(dc, dr) {
        if (dead > 0 || over) return;
        if (duck.hopT > 0) { queued = [dc, dr]; return; }
        started = true;
        const nr = duck.row + dr;
        let nc = Math.round(duck.x) + dc;
        if (nc < 0 || nc >= COLS || nr < 0) return;
        if (nr < camY - 0.2) return;
        const lane = lanes[nr];
        if (lane && lane.type === "grass" && lane.bushes.has(nc)) { Sound.play("bounce"); return; }
        duck.fromX = duck.x; duck.fromRow = duck.row;
        duck.col = nc; duck.row = nr; duck.x = nc;
        duck.hopT = HOP;
        if (dc) duck.face = dc < 0 ? 1 : 0;
        Sound.tone(dr > 0 ? 700 : 500, 0.06, { vol: 0.12, slide: dr > 0 ? 1100 : 400 });
      }

      function lose(why) {
        if (invuln > 0 || dead > 0) return;
        lives--;
        dead = 1.0;
        const p = screenPos();
        fx.burst(p.x + C / 2, p.y + C / 2, "#ffffff", 24, 200, 0.8, S);
        if (chicks) fx.burst(p.x + C / 2, p.y + C / 2, "#ffd63c", 6 * chicks, 220, 0.9, S);
        chicks = 0; followers = [];
        Sound.play(why === "water" ? "lose" : "boom");
        banner.show(why === "hawk" ? "HAWK!" : why === "water" ? "WASHED AWAY!" : "SPLAT!", "", "#fff", "#ff3c50", 1);
      }

      function respawn() {
        dead = 0;
        if (lives <= 0) { over = true; overT = 0.6; return; }
        let r = Math.max(0, Math.ceil(camY + 1));
        while (lanes[r] && lanes[r].type !== "grass") r++;
        duck.row = r; duck.fromRow = r;
        const lane = lanes[r];
        let c = 4;
        while (lane.bushes.has(c)) c = (c + 1) % COLS;
        duck.col = c; duck.x = c; duck.fromX = c; duck.hopT = 0;
        invuln = 1.6;
        camY = Math.max(camY, r - 3);
      }

      function screenPos() {
        const k = duck.hopT > 0 ? 1 - duck.hopT / HOP : 1;
        const row = duck.fromRow + (duck.row - duck.fromRow) * k;
        const x = duck.fromX + (duck.x - duck.fromX) * k;
        const lift = duck.hopT > 0 ? Math.sin(k * Math.PI) * C * 0.25 : 0;
        return { x: ox + x * C, y: H - (row - camY + 1) * C - lift };
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (dead > 0) { dead -= dt; if (dead <= 0) respawn(); return; }
        invuln = Math.max(0, invuln - dt);
        while (genRow < camY + H / C + 10) addLane();

        // trains
        for (let r = Math.floor(camY); r < camY + H / C + 2; r++) {
          const lane = lanes[r];
          if (!lane || lane.type !== "rail") continue;
          if (lane.train) {
            lane.train.x += lane.dir * lane.speed * dt;
            if ((lane.dir > 0 && lane.train.x > COLS + 1) || (lane.dir < 0 && lane.train.x + lane.train.len < -1)) {
              lane.train = null; lane.timer = Kit.rand(2, 5.5) / Math.min(2, lane.L);
            }
          } else {
            lane.timer -= dt;
            if (lane.timer <= 1.1 && lane.warn === 0) { lane.warn = 1; if (Math.abs(r - duck.row) < 6) Sound.tone(1200, 0.08, { vol: 0.1 }); }
            if (lane.timer <= 0) {
              const len = 10;
              lane.train = { len, x: lane.dir > 0 ? -len - 1 : COLS + 1 };
              lane.warn = 0;
              if (Math.abs(r - duck.row) < 6) Sound.noise(0.6, { vol: 0.18, freq: 1200 });
            }
          }
        }

        if (duck.hopT > 0) {
          duck.hopT -= dt;
          if (duck.hopT <= 0) {
            duck.hopT = 0;
            if (duck.row > best) {
              const gained = duck.row - best;
              best = duck.row;
              host.addScore(gained * 10 * (1 + chicks));
              host.tempo = Math.min(1.4, 1 + best / 300);
              Sound.setTempo(host.tempo);
              if (best % 50 === 0) { banner.show(best + " STEPS!", "", "#fff", "#4dff7a", 1); Sound.play("bonus"); }
            }
            const lane = lanes[duck.row];
            if (lane.type === "grass" && lane.chick === Math.round(duck.x)) {
              lane.chick = -1; chicks++;
              host.addScore(50);
              Sound.play("power");
              banner.show("DUCKLING!", "x" + (1 + chicks) + " POINTS", "#fff", "#ffd63c", 0.9);
            }
            if (queued) { const q = queued; queued = null; hop(q[0], q[1]); }
          }
        }

        // the current carries you along a canal
        const lane = lanes[duck.row];
        if (lane.type === "water" && duck.hopT === 0) {
          duck.x += lane.dir * lane.speed * 0.55 * dt;
          duck.fromX = duck.x;
          if (duck.x < -0.4 || duck.x > COLS - 0.6) { lose("water"); return; }
        } else if (duck.hopT === 0 && lane.type !== "water") {
          duck.x = Math.round(duck.x); duck.fromX = duck.x;
        }

        // hit?
        if (duck.hopT === 0 || duck.hopT < HOP / 2) {
          const h = hazardAt(duck.row, duck.x);
          if (h) { lose(h); return; }
        }

        // camera: follows you, and slowly creeps up by itself so you can't wait forever
        if (started) {
          const creep = Math.min(0.85, 0.18 + best * 0.004);
          camY += creep * dt;
          const want = duck.row - 3;
          if (want > camY) camY += (want - camY) * Math.min(1, dt * 4);
          if (duck.row < camY + 0.6) hawkWarn += dt; else hawkWarn = 0;
          if (duck.row < camY - 0.2) { lose("hawk"); return; }
        }
        // ducklings trail behind
        const p = screenPos();
        followers.unshift({ x: p.x, y: p.y });
        if (followers.length > chicks * 6 + 1) followers.length = chicks * 6 + 1;
      }

      function rowY(r) { return H - (r - camY + 1) * C; }

      function draw(g) {
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        const first = Math.floor(camY) - 1, last = Math.ceil(camY + H / C) + 1;
        for (let r = Math.max(0, first); r <= last; r++) {
          const lane = lanes[r];
          if (!lane) continue;
          const y = Math.round(rowY(r));
          if (lane.type === "grass") {
            g.fillStyle = r % 2 ? "#1a6a2a" : "#1e7a30"; g.fillRect(0, y, W, C);
            g.fillStyle = "#2a9a3a";
            for (let c = 0; c < COLS; c++) if ((c + r) % 3 === 0) g.fillRect(ox + c * C + C * 0.3, y + C * 0.4, 3, 3);
            for (const c of lane.bushes) {
              g.fillStyle = "#0e4a1a"; g.fillRect(ox + c * C + 3, y + 4, C - 6, C - 6);
              g.fillStyle = "#2ac04a"; g.fillRect(ox + c * C + 6, y + 6, C - 14, C / 3);
            }
            if (lane.chick >= 0) {
              const bob = Math.floor(t * 4) % 2 * 2;
              g.drawImage(chickImg, ox + lane.chick * C + (C - chickImg.width) / 2, y + (C - chickImg.height) / 2 - bob);
            }
          } else if (lane.type === "road") {
            g.fillStyle = "#26232e"; g.fillRect(0, y, W, C);
            g.fillStyle = "#5a5560";
            for (let x = (t * 0) % 30; x < W; x += 30) g.fillRect(x, y + C - 2, 14, 2);
            for (const it of lane.items) {
              const x = ox + itemX(lane, it) * C, w = it.len * C;
              if (x > W || x + w < 0) continue;
              g.fillStyle = it.color; g.fillRect(x + 2, y + 5, w - 4, C - 10);
              g.fillStyle = "rgba(0,0,0,.45)";
              const front = lane.dir > 0 ? x + w - C * 0.45 : x + 6;
              g.fillRect(front, y + 8, C * 0.3, C - 16);
              g.fillStyle = "#111";
              g.fillRect(x + 5, y + 2, 7, 4); g.fillRect(x + w - 12, y + 2, 7, 4);
              g.fillRect(x + 5, y + C - 6, 7, 4); g.fillRect(x + w - 12, y + C - 6, 7, 4);
              g.fillStyle = "#ffd63c";
              g.fillRect(lane.dir > 0 ? x + w - 4 : x + 2, y + 7, 2, 3);
              g.fillRect(lane.dir > 0 ? x + w - 4 : x + 2, y + C - 10, 2, 3);
            }
          } else if (lane.type === "water") {
            g.fillStyle = "#0a3a8a"; g.fillRect(0, y, W, C);
            g.fillStyle = "#2a6ad0";
            const off = (lane.dir * t * lane.speed * C * 0.55) % 24;
            for (let x = -24 + off; x < W + 24; x += 24) g.fillRect(x, y + C * 0.3 + (r % 2) * 8, 8, 2);
            for (const it of lane.items) {
              const x = ox + itemX(lane, it) * C, w = it.len * C;
              if (x > W || x + w < 0) continue;
              g.fillStyle = "#eeeeee"; g.fillRect(x + 2, y + 6, w - 4, C - 12);
              g.fillStyle = "#ff3c50"; g.fillRect(x + 2, y + C / 2 - 2, w - 4, 4);
              g.fillStyle = "#3cf0ff"; g.fillRect(lane.dir > 0 ? x + w * 0.5 : x + w * 0.25, y + 9, w * 0.25, C - 18);
              g.fillStyle = "rgba(255,255,255,.6)";
              const wake = lane.dir > 0 ? x - 6 : x + w + 2;
              g.fillRect(wake, y + 8, 4, 3); g.fillRect(wake, y + C - 11, 4, 3);
            }
          } else {
            g.fillStyle = "#2a1a10"; g.fillRect(0, y, W, C);
            g.fillStyle = "#5a3a20";
            for (let x = 0; x < W; x += 12) g.fillRect(x, y + 4, 6, C - 8);
            g.fillStyle = "#9a9aa8"; g.fillRect(0, y + 8, W, 3); g.fillRect(0, y + C - 11, W, 3);
            if (lane.warn && !lane.train && Math.floor(t * 8) % 2) {
              g.fillStyle = "#ff3c50"; g.fillRect(4, y + C / 2 - 5, 10, 10); g.fillRect(W - 14, y + C / 2 - 5, 10, 10);
            }
            if (lane.train) {
              const x = ox + lane.train.x * C, w = lane.train.len * C;
              g.fillStyle = "#c03040"; g.fillRect(x, y + 3, w, C - 6);
              g.fillStyle = "#ffd63c";
              for (let wx = x + 8; wx < x + w - 10; wx += C * 0.8) g.fillRect(wx, y + 8, C * 0.4, C / 3);
              g.fillStyle = "#fff"; g.fillRect(lane.dir > 0 ? x + w - 6 : x + 2, y + C / 2 - 3, 4, 6);
            }
          }
        }
        // ducklings in a line, then the duck
        for (let i = 1; i <= chicks; i++) {
          const f = followers[Math.min(followers.length - 1, i * 6)];
          if (f) g.drawImage(chickImg, f.x + (C - chickImg.width) / 2, f.y + C * 0.35);
        }
        if (dead <= 0 && (invuln <= 0 || Math.floor(t * 10) % 2)) {
          const p = screenPos();
          g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(p.x + C * 0.2, rowY(duck.row) + C * 0.8, C * 0.6, 4);
          const img = duckImg[duck.face];
          g.drawImage(img, Math.round(p.x + (C - img.width) / 2), Math.round(p.y + (C - img.height) / 2));
        }
        // the hawk's shadow at the bottom when you lag behind
        if (hawkWarn > 0 && Math.floor(t * 6) % 2) {
          g.fillStyle = "rgba(0,0,0,.5)";
          const hx = W / 2 + Math.sin(t * 3) * W * 0.3;
          g.fillRect(hx - 30, H - 26, 60, 8); g.fillRect(hx - 8, H - 32, 16, 20);
          Kit.text(g, "HAWK!", W / 2, H - 44, 10, "#ff3c50");
        }
        fx.draw(g);
        for (let i = 0; i < lives; i++) g.drawImage(duckImg[0], 6 + i * (duckImg[0].width * 0.7 + 4), 4, duckImg[0].width * 0.7, duckImg[0].height * 0.7);
        Kit.text(g, best + " STEPS", W - 6, 12, 8, "#fff", "right");
        if (chicks) Kit.text(g, "x" + (1 + chicks), W - 6, 26, 8, "#ffd63c", "right");
        if (!started && Math.floor(t * 2) % 2 === 0) Kit.text(g, "TAP TO HOP", W / 2, H * 0.45, 12, "#fff", "center", "#ffd63c");
        banner.draw(g, W, H);
      }

      const DIRV = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
      const swipe = Kit.swiper(d => hop(...DIRV[d]), () => hop(0, 1), 22);

      const state = () => ({ best, lives, chicks, camY, dead: dead > 0, over, started,
        duck: { col: Math.round(duck.x), x: duck.x, row: duck.row, hopping: duck.hopT > 0 },
        lanes: lanes.slice(Math.max(0, duck.row - 1), duck.row + 4).map((l, i) => ({ row: Math.max(0, duck.row - 1) + i, type: l.type })),
        danger: (r, x) => !!hazardAt(r, x) });
      // for the tests: is a cell dangerous a little while from now?
      function safeIn(row, col, dtAhead) {
        const t0 = t; t += dtAhead;
        const h = hazardAt(row, col);
        t = t0;
        const lane = lanes[row];
        if (lane && lane.type === "rail" && (lane.train || lane.warn)) return false;
        if (lane && lane.type === "grass" && lane.bushes.has(col)) return false;
        return !h;
      }
      return { update, draw, down: swipe.down, move: swipe.move, up: swipe.up, state, safeIn,
        resize(w, h) { W = w; H = h; C = Math.floor(W / COLS); ox = Math.floor((W - C * COLS) / 2); } };
    },
  });
})();
