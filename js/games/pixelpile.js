// PIXEL PILE — small pieces of coloured pixels drop into the pile. Fill a whole row to clear it, or
// touch 4 or more pixels of the same colour together to pop them. Pops can set off chains for big
// points. Now and then a bomb drops: it blasts everything round where it lands. It speeds up, and
// new colours join in as you go. If the pile reaches the top, it's over.
// Drag left/right to move, tap to turn, flick down to drop.
(() => {
  Sound.defineSong("pixelpile", {
    bpm: 116,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "F2 . C3 . F3 . C3 .  D2 . A2 . D3 . A2 .  A#1 . F2 . A#2 . F2 .  C2 . G2 . C3 . E3 .") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "A4 - C5 - F5 - E5 -  D5 - - - A4 - - -  A#4 - D5 - F5 - D5 -  E5 - - - G5 - - -  " +
        "A5 - G5 - F5 - C5 -  D5 - E5 - F5 - - -  F5 - E5 - D5 - A#4 -  C5 - - - - - - -") },
      { drum: true, vol: 0.12, notes: Sound.notes("k . h . s . h .  k h . . s . h .") },
    ],
  });

  const COLORS = ["#ff3c50", "#4dff7a", "#3cf0ff", "#ffd63c", "#c04cff", "#ff8a3c"];
  // Pieces are lists of [x, y] cells; the first cell is what they turn round.
  const SHAPES = [
    [[0, 0], [1, 0]],                 // pair
    [[0, 0], [-1, 0], [1, 0]],        // bar of three
    [[0, 0], [1, 0], [0, 1]],         // corner
    [[0, 0], [0, 1]],                 // upright pair
  ];

  Arcade.addGame("pixelpile", {
    music: "pixelpile",
    deck: { stick: true, buttons: [{ id: "a", label: "TURN", color: "#3cf0ff" }, { id: "b", label: "DROP", color: "#c04cff" }] },
    arcadeHowTo: [
      "JOYSTICK LEFT/RIGHT: MOVE",
      "JOYSTICK DOWN: DROP SLOWLY, UP: DROP",
      "TURN: TURN THE PIECE, DROP: DROP IT",
      "FILL A ROW, OR JOIN 4 OF A COLOUR",
      "BOMBS BLAST WHERE THEY LAND",
    ],
    howTo: [
      "DRAG LEFT OR RIGHT TO MOVE",
      "TAP TO TURN THE PIECE",
      "FLICK DOWN TO DROP IT",
      "FILL A ROW, OR JOIN 4 OF A COLOUR",
      "BOMBS BLAST WHERE THEY LAND",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 8, ROWS = 14;
      let C, bx, by, side;
      function layout() {
        C = Math.floor(Math.min((W - 96) / COLS, (H - 24) / ROWS));
        side = 88;
        bx = Math.floor((W - (C * COLS + side)) / 2);
        by = Math.floor((H - C * ROWS) / 2);
      }
      layout();
      const fx = Kit.particles(), banner = Kit.banner();
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      let piece = null, next = null, fallT = 0, lockT = 0, level = 1, cleared = 0, over = false, overT = 0, t = 0;
      let resolving = null, chain = 0, drop = null, pieces = 0, riseIn = 18;
      const STONE = "stone"; // grey stone rows push up from below; they only clear as part of a full row
      const mult = () => Math.min(level, 10);

      const nColors = () => Math.min(COLORS.length, 3 + Math.floor((level + 2) / 3));
      const fallEvery = () => Math.max(0.07, 0.75 * Math.pow(0.86, level - 1));

      function makePiece() {
        if (Math.random() < 0.06 && level >= 2) return { cells: [[0, 0]], colors: ["bomb"], x: 3, y: 0 };
        const shape = Kit.pick(SHAPES);
        return { cells: shape.map(c => [...c]), colors: shape.map(() => COLORS[Kit.irand(0, nColors() - 1)]), x: 3, y: 0 };
      }
      function fits(p, x, y, cells = p.cells) {
        return cells.every(([cx, cy]) => {
          const gx = x + cx, gy = y + cy;
          return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
        });
      }
      // Every so often a row of stone (with one gap) pushes the whole pile up a row.
      function riseStone() {
        if (grid[0].some(c => c)) { over = true; overT = 1.2; Sound.play("lose"); return false; }
        grid.shift();
        const gap = Kit.irand(0, COLS - 1);
        grid.push(Array.from({ length: COLS }, (_, x) => (x === gap ? null : STONE)));
        Sound.tone(90, 0.3, { vol: 0.25, type: "triangle", slide: 60 });
        banner.show("STONE RISES!", "", "#fff", "#888", 0.8);
        return true;
      }

      function spawn() {
        pieces++;
        if (level >= 2 && --riseIn <= 0) {
          riseIn = Math.max(5, 20 - level * 1.5);
          if (!riseStone()) return;
        }
        piece = next || makePiece();
        next = makePiece();
        piece.x = 3; piece.y = 0;
        fallT = 0; lockT = 0;
        if (!fits(piece, piece.x, piece.y)) {
          over = true; overT = 1.2;
          Sound.play("lose");
          for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x]) grid[y][x] = "#555";
        }
      }

      function moveBy(dx) {
        if (!piece || resolving) return false;
        if (fits(piece, piece.x + dx, piece.y)) { piece.x += dx; lockT = 0; Sound.play("move"); return true; }
        return false;
      }
      function turn() {
        if (!piece || resolving || piece.cells.length < 2) return;
        const rot = piece.cells.map(([x, y]) => [-y, x]);
        for (const kick of [0, -1, 1, -2, 2]) {
          if (fits(piece, piece.x + kick, piece.y, rot)) { piece.cells = rot; piece.x += kick; lockT = 0; Sound.tone(900, 0.04, { vol: 0.12 }); return; }
        }
        // also try lifting it one row (for turning on the floor)
        if (fits(piece, piece.x, piece.y - 1, rot)) { piece.cells = rot; piece.y -= 1; Sound.tone(900, 0.04, { vol: 0.12 }); }
      }
      function hardDrop() {
        if (!piece || resolving) return;
        let n = 0;
        while (fits(piece, piece.x, piece.y + 1)) { piece.y++; n++; }
        host.addScore(n * 2);
        lock();
      }

      function lock() {
        const p = piece;
        piece = null;
        let bomb = null;
        p.cells.forEach(([cx, cy], i) => {
          const gx = p.x + cx, gy = p.y + cy;
          if (gy < 0) return;
          if (p.colors[i] === "bomb") bomb = [gx, gy];
          else grid[gy][gx] = p.colors[i];
        });
        Sound.tone(220, 0.08, { vol: 0.18, type: "triangle" });
        chain = 0;
        if (bomb) {
          const hits = [];
          for (let y = bomb[1] - 1; y <= bomb[1] + 1; y++) for (let x = bomb[0] - 1; x <= bomb[0] + 1; x++)
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS) hits.push([x, y]);
          Sound.play("boom");
          host.addScore(hits.filter(([x, y]) => grid[y][x]).length * 15 * mult());
          fx.burst(bx + bomb[0] * C + C / 2, by + bomb[1] * C + C / 2, "#ffd63c", 30, 220, 0.8, 3);
          resolving = { cells: hits, t: 0.25, gravity: true };
          return;
        }
        findClears();
      }

      // Find full rows and same-colour groups of 4 or more; flash them, then remove them.
      function findClears() {
        const mark = new Set();
        let rows = 0;
        for (let y = 0; y < ROWS; y++) if (grid[y].every(c => c)) { rows++; for (let x = 0; x < COLS; x++) mark.add(x + "," + y); }
        const seen = new Set();
        let groupCells = 0;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const col = grid[y][x];
          if (!col || col === STONE || seen.has(x + "," + y)) continue;
          const stack = [[x, y]], group = [];
          seen.add(x + "," + y);
          while (stack.length) {
            const [cx, cy] = stack.pop();
            group.push([cx, cy]);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, ny = cy + dy, k = nx + "," + ny;
              if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(k) && grid[ny][nx] === col) { seen.add(k); stack.push([nx, ny]); }
            }
          }
          if (group.length >= 4) { groupCells += group.length; group.forEach(([gx, gy]) => mark.add(gx + "," + gy)); }
        }
        if (!mark.size) { spawn(); return; }
        chain++;
        const pts = (rows * 100 + groupCells * 10) * mult() * chain;
        host.addScore(pts);
        cleared += mark.size;
        Sound.tone(Sound.N(72 + chain * 3), 0.12, { vol: 0.2 });
        Sound.tone(Sound.N(79 + chain * 3), 0.16, { vol: 0.18, delay: 0.08 });
        if (chain >= 2) banner.show("CHAIN x" + chain, "+" + pts, "#fff", "#c04cff", 0.9);
        else if (rows) banner.show(rows > 1 ? rows + " ROWS!" : "ROW!", "+" + pts, "#fff", "#3cf0ff", 0.7);
        resolving = { cells: [...mark].map(k => k.split(",").map(Number)), t: 0.28, gravity: true };
      }

      function settle() {
        for (const [x, y] of resolving.cells) {
          if (grid[y][x] && grid[y][x] !== "#555") fx.burst(bx + x * C + C / 2, by + y * C + C / 2, grid[y][x], 4, 120, 0.4, 3);
          grid[y][x] = null;
        }
        // every pixel falls down its column into the gaps
        for (let x = 0; x < COLS; x++) {
          let w = ROWS - 1;
          for (let y = ROWS - 1; y >= 0; y--) if (grid[y][x]) { const c = grid[y][x]; grid[y][x] = null; grid[w][x] = c; w--; }
        }
        resolving = null;
        const newLevel = 1 + Math.floor(cleared / 60);
        if (newLevel > level) {
          const colorsBefore = nColors();
          level = newLevel;
          banner.show("LEVEL " + level, nColors() > colorsBefore ? "NEW COLOUR!" : "FASTER!", "#fff", "#4dff7a", 1.2);
          Sound.play("power");
          host.tempo = Math.min(1.4, 1 + (level - 1) * 0.05);
          Sound.setTempo(host.tempo);
        }
        findClears();
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (resolving) { resolving.t -= dt; if (resolving.t <= 0) settle(); return; }
        if (!piece) return;
        arcadeHold(dt);
        if (!piece) return;
        fallT += dt;
        if (fits(piece, piece.x, piece.y + 1)) {
          lockT = 0;
          if (fallT >= fallEvery()) { fallT = 0; piece.y++; }
        } else {
          lockT += dt;
          if (lockT > 0.45) lock();
        }
      }

      function cell(g, x, y, col, size = C) {
        if (col === "bomb") {
          g.fillStyle = "#222"; g.fillRect(x + 2, y + 3, size - 4, size - 5);
          g.fillStyle = "#555"; g.fillRect(x + 4, y + 5, size / 3, size / 4);
          g.fillStyle = Math.floor(t * 8) % 2 ? "#ffd63c" : "#ff3c50"; g.fillRect(x + size / 2 - 2, y, 4, 5);
          return;
        }
        if (col === STONE) {
          g.fillStyle = "#4a4650"; g.fillRect(x + 1, y + 1, size - 2, size - 2);
          g.fillStyle = "#6a6670"; g.fillRect(x + 3, y + 3, size / 2, size / 4);
          g.fillStyle = "#2a2630"; g.fillRect(x + size / 2, y + size / 2 + 2, size / 3, size / 5);
          return;
        }
        g.fillStyle = col; g.fillRect(x + 1, y + 1, size - 2, size - 2);
        g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(x + 1, y + 1, size - 2, 3); g.fillRect(x + 1, y + 1, 3, size - 2);
        g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x + 1, y + size - 4, size - 2, 3); g.fillRect(x + size - 4, y + 1, 3, size - 2);
        g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(x + 5, y + 5, 3, 3);
      }

      function draw(g) {
        g.fillStyle = "#06000c"; g.fillRect(0, 0, W, H);
        // board
        g.fillStyle = "#0e0620"; g.fillRect(bx, by, C * COLS, C * ROWS);
        g.fillStyle = "#170a30";
        for (let x = 1; x < COLS; x++) g.fillRect(bx + x * C, by, 1, C * ROWS);
        for (let y = 1; y < ROWS; y++) g.fillRect(bx, by + y * C, C * COLS, 1);
        g.strokeStyle = "#c04cff"; g.lineWidth = 2;
        g.globalAlpha = 0.3; g.strokeRect(bx - 5, by - 5, C * COLS + 10, C * ROWS + 10);
        g.globalAlpha = 1; g.strokeRect(bx - 2, by - 2, C * COLS + 4, C * ROWS + 4);
        const flash = resolving && Math.floor(t * 20) % 2;
        const marked = resolving ? new Set(resolving.cells.map(c => c.join(","))) : null;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const col = grid[y][x];
          if (!col) continue;
          if (marked && marked.has(x + "," + y) && flash) { g.fillStyle = "#fff"; g.fillRect(bx + x * C + 1, by + y * C + 1, C - 2, C - 2); continue; }
          cell(g, bx + x * C, by + y * C, col);
        }
        if (piece) {
          // ghost: where it will land
          let gy = piece.y;
          while (fits(piece, piece.x, gy + 1)) gy++;
          g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2;
          for (const [cx, cy] of piece.cells) if (gy + cy >= 0) g.strokeRect(bx + (piece.x + cx) * C + 3, by + (gy + cy) * C + 3, C - 6, C - 6);
          piece.cells.forEach(([cx, cy], i) => { if (piece.y + cy >= 0) cell(g, bx + (piece.x + cx) * C, by + (piece.y + cy) * C, piece.colors[i]); });
        }
        fx.draw(g);
        // side panel
        const sx = bx + C * COLS + 14, nc = Math.floor(C * 0.7);
        Kit.text(g, "NEXT", sx, by + 8, 8, "#c04cff", "left");
        g.fillStyle = "#0e0620"; g.fillRect(sx, by + 18, side - 18, nc * 3 + 8);
        if (next) next.cells.forEach(([cx, cy], i) => cell(g, sx + 4 + (cx + 1) * nc, by + 22 + (cy + 0.5) * nc, next.colors[i], nc));
        Kit.text(g, "LEVEL", sx, by + nc * 3 + 50, 8, "#c04cff", "left");
        Kit.text(g, String(level), sx, by + nc * 3 + 68, 14, "#fff", "left");
        Kit.text(g, "COLOURS", sx, by + nc * 3 + 100, 7, "#c04cff", "left");
        for (let i = 0; i < nColors(); i++) { g.fillStyle = COLORS[i]; g.fillRect(sx + (i % 3) * 18, by + nc * 3 + 112 + Math.floor(i / 3) * 18, 14, 14); }
        banner.draw(g, W, H);
      }

      // Touch: horizontal drag moves a column per cell-width of travel, a still tap turns,
      // a quick downward flick drops, a slow downward drag nudges it down.
      function down(x, y) { drop = { x0: x, y0: y, x, y, t: performance.now(), moved: false, ax: 0, ay: 0 }; }
      function move(x, y) {
        if (!drop) return;
        drop.ax += x - drop.x; drop.ay += y - drop.y;
        drop.x = x; drop.y = y;
        const step = C * 0.85;
        while (drop.ax > step) { moveBy(1); drop.ax -= step; drop.moved = true; }
        while (drop.ax < -step) { moveBy(-1); drop.ax += step; drop.moved = true; }
        if (drop.ay > C * 1.2 && Math.abs(y - drop.y0) > Math.abs(x - drop.x0)) {
          if (piece && !resolving && fits(piece, piece.x, piece.y + 1)) { piece.y++; fallT = 0; host.addScore(1); }
          drop.ay = 0; drop.moved = true;
        }
        if (drop.ay < 0) drop.ay = 0;
      }
      function up(x, y) {
        if (!drop) return;
        const dt = performance.now() - drop.t, dy = y - drop.y0, dx = x - drop.x0;
        if (dt < 300 && dy > 50 && dy > Math.abs(dx) * 1.5) hardDrop();
        else if (!drop.moved && Math.abs(dx) < 12 && Math.abs(dy) < 12) turn();
        drop = null;
      }

      // Arcade mode: joystick left/right moves (hold to keep sliding), down drops slowly, up drops fast;
      // TURN turns, DROP drops.
      let holdT = 0;
      function softDrop() { if (piece && !resolving && fits(piece, piece.x, piece.y + 1)) { piece.y++; fallT = 0; host.addScore(1); } }
      function arcade(ev) {
        if (ev.type === "dir") {
          if (ev.dir === "left") moveBy(-1);
          if (ev.dir === "right") moveBy(1);
          if (ev.dir === "down") softDrop();
          if (ev.dir === "up") hardDrop();
          holdT = 0.18;
        }
        if (ev.type === "down" && ev.id === "a") turn();
        if (ev.type === "down" && ev.id === "b") hardDrop();
      }
      function arcadeHold(dt) {
        if (!host.arcade || !host.pad.dir || host.pad.dir === "up") return;
        holdT -= dt;
        if (holdT > 0) return;
        if (host.pad.dir === "left") moveBy(-1);
        if (host.pad.dir === "right") moveBy(1);
        if (host.pad.dir === "down") softDrop();
        holdT = host.pad.dir === "down" ? 0.05 : 0.07;
      }

      spawn();
      const state = () => ({ level, cleared, over, colors: nColors(), fallEvery: fallEvery(), resolving: !!resolving,
        piece: piece && { x: piece.x, y: piece.y, cells: piece.cells, colors: piece.colors }, grid: grid.map(r => r.map(c => c || 0)), C, bx, by, cols: COLS, rows: ROWS });
      return { update, draw, down, move, up, arcade, state, resize(w, h) { W = w; H = h; layout(); }, _test: { moveBy, turn, hardDrop } };
    },
  });
})();
