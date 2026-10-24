// VAULT RUNNER — a masked thief sneaks through a new vault maze each level, grabbing every coin while
// guard bots hunt them down. Blue EMP gems freeze every bot for a few seconds so you can slip past.
// Stay too long and the alarm goes off: the bots speed up.
// Swipe to change direction (the thief remembers your next turn and takes it at the next gap).
(() => {
  Sound.defineSong("vaultrunner", {
    bpm: 112,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "D2 . . D2 . . F2 .  D2 . . D2 . G2 F2 .  C2 . . C2 . . E2 .  A1 . . A1 . C2 D2 .") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "D4 . F4 . A4 . . G4  F4 . E4 . D4 . . .  C4 . E4 . G4 . . F4  E4 . C#4 . A3 . . .") },
      { drum: true, vol: 0.14, notes: Sound.notes("k . . h s . h .  k . h . s . . h") },
    ],
  });

  const THIEF = ["..kkkk..", ".kkkkkk.", ".swkkws.", ".ssssss.", "..ssss..", ".rrrrrr.", "s.rrrr.s", "..b..b.."];
  const THIEF_PAL = { k: "#222233", s: "#f0b080", w: "#ffffff", r: "#c04cff", b: "#4040a0" };
  const BOT = [
    ["...a....", "..aaaa..", ".gggggg.", "gweggewg", "gggggggg", ".gkkkkg.", ".gg..gg.", ".g....g."],
    ["....a...", "..aaaa..", ".gggggg.", "gegwwgeg", "gggggggg", ".gkkkkg.", "..gg.gg.", "..g..g.."],
  ];
  const BOT_COLORS = ["#ff3c50", "#ff8a3c", "#ff3cc8", "#4dff7a", "#ffd63c"];
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIR_LIST = Object.values(DIRS);

  // A new random maze: a depth-first maze on a coarse grid, then some walls knocked out so there are
  // loops to escape round, and an open dock in the middle where the bots start.
  function makeMaze(cols, rows) {
    const g = Array.from({ length: rows }, () => Array(cols).fill(1));
    const cw = (cols - 1) / 2, ch = (rows - 1) / 2;
    const seen = Array.from({ length: ch }, () => Array(cw).fill(false));
    const stack = [[0, ch - 1]];
    seen[ch - 1][0] = true;
    g[(ch - 1) * 2 + 1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny][nx];
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = Kit.pick(opts);
      const nx = cx + dx, ny = cy + dy;
      seen[ny][nx] = true;
      g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
      g[ny * 2 + 1][nx * 2 + 1] = 0;
      stack.push([nx, ny]);
    }
    // knock out walls between corridors for loops
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      if (g[y][x] !== 1) continue;
      const horiz = g[y][x - 1] === 0 && g[y][x + 1] === 0 && g[y - 1][x] === 1 && g[y + 1][x] === 1;
      const vert = g[y - 1][x] === 0 && g[y + 1][x] === 0 && g[y][x - 1] === 1 && g[y][x + 1] === 1;
      if ((horiz || vert) && Math.random() < 0.28) g[y][x] = 0;
    }
    // fill in dead ends' last step about half the time, so fewer traps
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      if (g[y][x] !== 0) continue;
      const open = DIR_LIST.filter(([dx, dy]) => g[y + dy][x + dx] === 0).length;
      if (open === 1 && Math.random() < 0.6) {
        const walls = DIR_LIST.filter(([dx, dy]) => g[y + dy][x + dx] === 1 && x + dx > 0 && y + dy > 0 && x + dx < cols - 1 && y + dy < rows - 1);
        if (walls.length) { const [dx, dy] = Kit.pick(walls); g[y + dy][x + dx] = 0; }
      }
    }
    // the bots' dock: a small open room in the middle
    const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
    for (let y = my - 1; y <= my + 1; y++) for (let x = mx - 2; x <= mx + 2; x++) g[y][x] = 0;
    return g;
  }

  Arcade.addGame("vaultrunner", {
    music: "vaultrunner",
    howTo: [
      "SWIPE TO CHANGE DIRECTION",
      "GRAB EVERY COIN TO CRACK THE VAULT",
      "DODGE THE GUARD BOTS",
      "BLUE GEMS FREEZE THE BOTS",
      "TOO SLOW AND THE ALARM SOUNDS",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 13, ROWS = 19;
      let T, ox, oy;
      function layout() {
        T = Math.floor(Math.min(W / COLS, (H - 24) / ROWS));
        ox = Math.floor((W - T * COLS) / 2);
        oy = Math.floor((H - 24 - T * ROWS) / 2) + 20;
      }
      layout();
      const S = Math.max(2, Math.floor(T / 9));
      const thiefImg = Pixel.bake(THIEF, THIEF_PAL, S);
      const botImgs = BOT_COLORS.map(c => BOT.map(f => Pixel.bake(f, { a: "#ffffff", g: c, w: "#ffffff", e: "#000000", k: "#111111" }, S)));
      const frozenImg = BOT.map(f => Pixel.bake(f, { a: "#ffffff", g: "#3cf0ff", w: "#ffffff", e: "#2060ff", k: "#114" }, S));
      const fx = Kit.particles(), banner = Kit.banner();

      let level = 0, lives = 3, t = 0, maze, loot, gems, mazeImg, left;
      let thief, bots, freezeT = 0, alarmT, alarm = false, caughtT = 0, over = false, overT = 0, releaseT = 0;
      const START = { x: Math.floor(COLS / 2), y: ROWS - 2 };

      function open(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && maze[y][x] === 0; }

      function drawMaze() {
        mazeImg = document.createElement("canvas");
        mazeImg.width = T * COLS; mazeImg.height = T * ROWS;
        const g = mazeImg.getContext("2d");
        g.fillStyle = "#07040f"; g.fillRect(0, 0, mazeImg.width, mazeImg.height);
        const hue = ["#7a14be", "#2060ff", "#c0207a", "#14a08a"][(level - 1) % 4];
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (maze[y][x] !== 1) continue;
          g.fillStyle = hue; g.fillRect(x * T, y * T, T, T);
          g.fillStyle = "rgba(255,255,255,.22)";
          if (y === 0 || open(x, y - 1)) g.fillRect(x * T, y * T, T, 2);
          g.fillStyle = "rgba(0,0,0,.35)";
          if (open(x, y + 1)) g.fillRect(x * T, y * T + T - 3, T, 3);
          g.fillStyle = "rgba(0,0,0,.25)";
          g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
          g.fillStyle = hue; g.fillRect(x * T + 4, y * T + 4, T - 8, T - 8);
        }
        // the dock's door
        const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
        g.fillStyle = "#3cf0ff"; g.globalAlpha = 0.25;
        g.fillRect((mx - 2) * T, (my - 1) * T, T * 5, T * 3);
        g.globalAlpha = 1;
      }

      function newVault() {
        level++;
        maze = makeMaze(COLS, ROWS);
        maze[START.y][START.x] = 0;
        // make sure the start joins the maze
        if (!open(START.x, START.y - 1) && !open(START.x - 1, START.y) && !open(START.x + 1, START.y)) maze[START.y - 1][START.x] = 0;
        loot = new Set(); gems = new Set();
        const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (maze[y][x] !== 0) continue;
          if (Math.abs(x - mx) <= 2 && Math.abs(y - my) <= 1) continue;
          if (x === START.x && y === START.y) continue;
          loot.add(x + "," + y);
        }
        // four gems, one in each corner region
        for (const [qx, qy] of [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]]) {
          let best = null, bd = 1e9;
          for (const k of loot) { const [x, y] = k.split(",").map(Number); const d = Math.abs(x - qx) + Math.abs(y - qy); if (d < bd) { bd = d; best = k; } }
          if (best) { loot.delete(best); gems.add(best); }
        }
        left = loot.size;
        drawMaze();
        alarmT = Math.max(25, 60 - level * 5);
        alarm = false;
        resetActors();
        banner.show("VAULT " + level, level === 1 ? "SWIPE TO MOVE" : "", "#fff", "#ffd63c", 1.6);
        host.tempo = Math.min(1.4, 1 + (level - 1) * 0.06);
        Sound.setTempo(host.tempo);
      }

      function resetActors() {
        thief = { x: START.x, y: START.y, px: START.x, py: START.y, dir: [0, 0], want: null, prog: 0, face: 1 };
        const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
        const n = Math.min(5, 1 + level); // 2 bots in the first vault, one more each vault after
        bots = [];
        for (let i = 0; i < n; i++) {
          bots.push({ x: mx - 2 + (i % 5), y: my, px: mx - 2 + (i % 5), py: my, dir: [0, -1], prog: 0, kind: i % 3, color: i % BOT_COLORS.length, out: false, wait: 1 + i * 3 });
        }
        freezeT = 0; releaseT = 0;
        started = false; // after a catch or a new vault, wait for the next swipe
      }

      // Speed in tiles per second.
      const thiefSpeed = () => 5.2;
      const botSpeed = () => Math.min(5.4, 3.0 + level * 0.3) * (alarm ? 1.22 : 1);

      // Moves an actor from tile to tile; `choose` picks the direction at each tile centre.
      function stepActor(a, speed, dt, choose) {
        a.prog += speed * dt;
        while (a.prog >= 1) {
          a.prog -= 1;
          a.px = a.x; a.py = a.y;
          const d = choose(a);
          a.dir = d;
          if (d[0] || d[1]) { a.x += d[0]; a.y += d[1]; }
          else { a.prog = 0; break; }
        }
      }
      const pos = a => ({ x: a.px + (a.x - a.px) * a.prog, y: a.py + (a.y - a.py) * a.prog });

      function chooseThief(a) {
        if (a.want && open(a.x + a.want[0], a.y + a.want[1])) { a.dir = a.want; a.want = null; }
        if (a.dir[0]) a.face = a.dir[0];
        return open(a.x + a.dir[0], a.y + a.dir[1]) ? a.dir : [0, 0];
      }

      function chooseBot(b) {
        const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
        let opts = DIR_LIST.filter(d => open(b.x + d[0], b.y + d[1]) && !(d[0] === -b.dir[0] && d[1] === -b.dir[1]));
        if (!opts.length) opts = DIR_LIST.filter(d => open(b.x + d[0], b.y + d[1]));
        // three personalities: hunter goes for you, cutter aims ahead of you, roamer mostly wanders
        let tx = thief.x, ty = thief.y;
        if (b.kind === 1) { tx += thief.dir[0] * 4; ty += thief.dir[1] * 4; }
        const smart = b.kind === 2 ? 0.35 : Math.min(0.92, 0.45 + level * 0.08);
        if (Math.random() > smart) return Kit.pick(opts);
        // leave the dock first
        if (Math.abs(b.x - mx) <= 2 && Math.abs(b.y - my) <= 1) { ty = 0; }
        opts.sort((p, q) => (Math.abs(b.x + p[0] - tx) + Math.abs(b.y + p[1] - ty)) - (Math.abs(b.x + q[0] - tx) + Math.abs(b.y + q[1] - ty)));
        return opts[0];
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (caughtT > 0) {
          caughtT -= dt;
          if (caughtT <= 0) { if (lives <= 0) { over = true; overT = 0.4; } else resetActors(); }
          return;
        }
        if (!started) return; // nothing moves until the first swipe

        alarmT -= dt;
        if (alarmT <= 0 && !alarm) { alarm = true; banner.show("ALARM!", "THE BOTS SPEED UP", "#fff", "#ff3c50", 1.5); Sound.play("lose"); }
        freezeT = Math.max(0, freezeT - dt);

        stepActor(thief, thiefSpeed(), dt, chooseThief);
        // collect what's on the tile we're mostly on
        const p = pos(thief);
        const k = Math.round(p.x) + "," + Math.round(p.y);
        if (loot.has(k)) {
          loot.delete(k); left--;
          host.addScore(10);
          if (left % 2 === 0) Sound.tone(Sound.N(84 + (left % 4)), 0.03, { vol: 0.1 });
        }
        if (gems.has(k)) {
          gems.delete(k);
          freezeT = Math.max(3, 7 - level * 0.4);
          host.addScore(50);
          Sound.play("power");
          banner.show("FREEZE!", "", "#fff", "#3cf0ff", 0.8);
        }
        if (!loot.size) {
          host.addScore(500 * level + (alarm ? 0 : Math.round(alarmT) * 10));
          Sound.play("bonus");
          banner.show("VAULT CRACKED!", alarm ? "" : "TIME BONUS", "#fff", "#ffd63c", 1.4);
          newVault();
          return;
        }

        releaseT += dt;
        for (const b of bots) {
          if (!b.out) { if (releaseT > b.wait) b.out = true; else continue; }
          if (freezeT > 0) continue;
          stepActor(b, botSpeed(), dt, chooseBot);
        }
        // caught?
        if (freezeT <= 0) {
          for (const b of bots) {
            const q = pos(b);
            if (Math.abs(q.x - p.x) < 0.6 && Math.abs(q.y - p.y) < 0.6) {
              lives--;
              caughtT = 1.4;
              Sound.play("boom");
              fx.burst(ox + p.x * T + T / 2, oy + p.y * T + T / 2, "#c04cff", 30, 200, 0.9, S);
              break;
            }
          }
        }
      }

      function draw(g) {
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        g.drawImage(mazeImg, ox, oy);
        // coins
        // gold coins: a rim, a darker face with a slot, and a glint
        const c = Math.max(4, Math.floor(T / 4));
        for (const k of loot) {
          const [x, y] = k.split(",").map(Number);
          const cx = Math.round(ox + x * T + T / 2 - c / 2), cy = Math.round(oy + y * T + T / 2 - c / 2);
          g.fillStyle = "#ffd63c"; g.fillRect(cx, cy + 1, c, c - 2); g.fillRect(cx + 1, cy, c - 2, c);
          g.fillStyle = "#c08a00"; g.fillRect(cx + 2, cy + 2, c - 4, c - 4);
          g.fillStyle = "#ffd63c"; g.fillRect(cx + c / 2 - 1, cy + 2, 2, c - 4);
          g.fillStyle = "#fff"; g.fillRect(cx + 1, cy + 1, 1, 1);
        }
        // gems
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        for (const k of gems) {
          const [x, y] = k.split(",").map(Number);
          const cx = ox + x * T + T / 2, cy = oy + y * T + T / 2, r = T * (0.25 + 0.06 * pulse);
          g.fillStyle = "#3cf0ff";
          g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill();
          g.fillStyle = "#fff"; g.fillRect(cx - 1, cy - r / 2, 2, 2);
        }
        // bots
        const frame = Math.floor(t * 6) % 2;
        for (const b of bots) {
          const q = pos(b);
          const flash = freezeT > 0 && freezeT < 1.2 && Math.floor(t * 10) % 2;
          const img = freezeT > 0 && !flash ? frozenImg[0] : botImgs[b.color][frame];
          g.drawImage(img, Math.round(ox + q.x * T + (T - img.width) / 2), Math.round(oy + q.y * T + (T - img.height) / 2));
        }
        // thief
        if (caughtT <= 0 || Math.floor(t * 10) % 2) {
          const q = pos(thief);
          const bob = (thief.dir[0] || thief.dir[1]) ? Math.floor(t * 10) % 2 : 0;
          g.save();
          const px = Math.round(ox + q.x * T + T / 2), py = Math.round(oy + q.y * T + T / 2 - bob);
          g.translate(px, py);
          if (thief.face < 0) g.scale(-1, 1);
          g.drawImage(thiefImg, -thiefImg.width / 2, -thiefImg.height / 2);
          g.restore();
        }
        fx.draw(g);
        // top bar: lives, coins left, alarm clock
        for (let i = 0; i < lives; i++) g.drawImage(thiefImg, 6 + i * (thiefImg.width + 4), 2, thiefImg.width * 0.8, thiefImg.height * 0.8);
        Kit.text(g, "VAULT " + level, W / 2, 10, 8, "#ffd63c");
        if (!started && caughtT <= 0 && Math.floor(t * 2) % 2 === 0) Kit.text(g, "SWIPE TO GO", W / 2, oy + T * (ROWS - 3.5), 10, "#fff", "center", "#c04cff");
        if (alarm) { if (Math.floor(t * 4) % 2) Kit.text(g, "ALARM", W - 6, 10, 8, "#ff3c50", "right"); }
        else Kit.text(g, "ALARM " + Math.ceil(alarmT), W - 6, 10, 8, alarmT < 10 ? "#ff3c50" : "#888", "right");
        banner.draw(g, W, H);
      }

      let started = false;
      const swipe = Kit.swiper(dir => {
        if (caughtT > 0 || over) return;
        started = true;
        const d = DIRS[dir];
        const standing = thief.x === thief.px && thief.y === thief.py;
        if (standing) {
          // standing still: set off at once if that way is open, otherwise remember it
          if (open(thief.x + d[0], thief.y + d[1])) {
            thief.dir = d; thief.want = null; thief.prog = 0;
            thief.x += d[0]; thief.y += d[1];
          } else thief.want = d;
        } else if (d[0] === -thief.dir[0] && d[1] === -thief.dir[1]) {
          // turn round mid-corridor: swap where we came from and where we're going
          const bx = thief.px, by = thief.py;
          thief.px = thief.x; thief.py = thief.y; thief.x = bx; thief.y = by;
          thief.prog = 1 - thief.prog; thief.dir = d; thief.want = null;
        } else thief.want = d;
        if (d[0]) thief.face = d[0];
        Sound.play("move");
      }, null, 16);

      newVault();
      const state = () => ({ started, level, lives, left: loot.size, alarm, freezeT, caught: caughtT > 0, over,
        thief: { x: thief.x, y: thief.y, dir: thief.dir, prog: thief.prog, want: thief.want },
        bots: bots.map(b => ({ ...pos(b), out: b.out })), maze, loot: [...loot], gems: [...gems], botSpeed: botSpeed() });
      return { update, draw, down: swipe.down, move: swipe.move, up: swipe.up, resize(w, h) { W = w; H = h; const oldT = T; layout(); if (T !== oldT) drawMaze(); }, state };
    },
  });
})();
