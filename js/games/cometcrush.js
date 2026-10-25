// COMET CRUSH — a lone tug-ship in a comet storm. Blast the big comets and they crack into smaller,
// faster ones. Small ones sometimes leave a crystal: grab it for points and to cool your gun.
// Hold fire too long and the gun overheats. Later waves bring red fireballs that steer toward you.
// On-screen buttons: turn left, turn right, thrust and fire (use two thumbs at once).
(() => {
  Sound.defineSong("cometcrush", {
    bpm: 124,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "E2 . E2 . E2 . G2 .  E2 . E2 . D2 . C2 .  E2 . E2 . E2 . G2 .  A2 . G2 . D2 . B1 .") },
      { type: "square", vol: 0.07, notes: Sound.notes(
        "B4 - - - G4 - - -  A4 - - - F#4 - E4 -  B4 - - - D5 - - -  C5 - B4 - A4 - F#4 -") },
      { drum: true, vol: 0.16, notes: Sound.notes("k . . . s . . .  k . k . s . . h") },
    ],
  });

  const SHIP = [
    "....ww....",
    "...wccw...",
    "...wccw...",
    "..wwccww..",
    "..wbbbbw..",
    ".wwbbbbww.",
    "wwwwwwwwww",
    "ww.r..r.ww",
  ];
  const SHIP_PAL = { w: "#e0e0f0", c: "#3cf0ff", b: "#2060ff", r: "#ff8a3c" };

  // A comet: a lumpy round pixel rock with craters, made fresh so no two look the same.
  function bakeComet(r, kind) {
    const pal = kind === "fire"
      ? ["#ff3c50", "#ff8a3c", "#ffd63c", "#a01020"]
      : ["#8a7a6a", "#b0a090", "#5a4a40", "#3a2a20"];
    const px = Math.max(2, Math.round(r / 7));
    const n = Math.ceil((r * 2) / px);
    const c = document.createElement("canvas");
    c.width = c.height = n * px;
    const g = c.getContext("2d");
    const bumps = Array.from({ length: 7 }, () => Kit.rand(0.8, 1));
    const craters = Array.from({ length: Math.max(1, Math.round(r / 12)) }, () => [Kit.rand(0.25, 0.75) * n, Kit.rand(0.25, 0.75) * n, Kit.rand(0.08, 0.18) * n]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2, dy = y + 0.5 - n / 2;
      const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) / (n / 2);
      const edge = bumps[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 7) % 7];
      if (d > edge) continue;
      let col = d > edge - 0.18 ? pal[2] : (dx + dy < 0 ? pal[1] : pal[0]);
      for (const [cx, cy, cr] of craters) if (Math.hypot(x - cx, y - cy) < cr) col = pal[3];
      g.fillStyle = col;
      g.fillRect(x * px, y * px, px, px);
    }
    return c;
  }

  const SIZES = { 3: 34, 2: 20, 1: 11 };
  const POINTS = { 3: 20, 2: 50, 1: 100 };

  Arcade.addGame("cometcrush", {
    music: "cometcrush",
    deck: { stick: true, buttons: [{ id: "a", label: "FIRE", color: "#ff3c50" }, { id: "b", label: "THRUST", color: "#ff8a3c" }] },
    arcadeHowTo: [
      "JOYSTICK LEFT/RIGHT: TURN",
      "JOYSTICK UP OR THRUST: FLY",
      "FIRE: SHOOT",
      "BIG COMETS CRACK INTO SMALL ONES",
      "GRAB CRYSTALS TO COOL YOUR GUN",
    ],
    howTo: [
      "◀ ▶ TURN YOUR SHIP",
      "THRUST TO FLY, FIRE TO SHOOT",
      "BIG COMETS CRACK INTO SMALL ONES",
      "GRAB CRYSTALS TO COOL YOUR GUN",
      "DON'T LET THE GUN OVERHEAT",
    ],
    create(host) {
      let W = host.W, H = host.H;
      let PH, buttons;
      function layout() {
        PH = host.arcade ? H : H - 112; // play area; the button bar is below (Arcade mode uses the deck instead)
        const bw = Math.floor((W - 50) / 4), bh = 84, y = PH + 18;
        buttons = host.arcade ? [] : [
          { id: "left", label: "◀", x: 10, y, w: bw, h: bh, color: "#3cf0ff" },
          { id: "right", label: "▶", x: 20 + bw, y, w: bw, h: bh, color: "#3cf0ff" },
          { id: "thrust", label: "THRUST", x: W - 20 - bw * 2, y, w: bw, h: bh, color: "#ff8a3c" },
          { id: "fire", label: "FIRE", x: W - 10 - bw, y, w: bw, h: bh, color: "#ff3c50" },
        ];
      }
      layout();
      const S = Math.max(2, Math.round(W / 150));
      const shipImg = Pixel.bake(SHIP, SHIP_PAL, S);
      const fx = Kit.particles(), banner = Kit.banner();
      const held = {};          // which buttons are down
      const touches = new Map(); // pointer id -> button id

      const ship = { x: W / 2, y: PH / 2, vx: 0, vy: 0, a: -Math.PI / 2, r: shipImg.width * 0.38 };
      let comets = [], bullets = [], crystals = [];
      let wave = 0, lives = 3, invuln = 2, fireT = 0, heat = 0, hot = false, t = 0, dead = 0, over = false, overT = 0, nextWaveT = 1;
      const stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * PH, b: Math.random() }));

      function addComet(size, x, y, speedK, kind = "rock") {
        const a = Math.random() * Math.PI * 2;
        const sp = Kit.rand(28, 60) * speedK * (4 - size) ** 0.6;
        comets.push({ size, kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: SIZES[size], rot: 0, spin: Kit.rand(-1.5, 1.5), img: bakeComet(SIZES[size], kind), hp: kind === "fire" ? 1 : 1 });
      }

      function spawnWave() {
        wave++;
        const k = 1 + (wave - 1) * 0.1;
        const n = Math.min(9, 2 + wave);
        for (let i = 0; i < n; i++) {
          // start at the edges, away from the ship
          let x, y;
          do { if (Math.random() < 0.5) { x = Math.random() * W; y = Math.random() < 0.5 ? -30 : PH + 30; } else { x = Math.random() < 0.5 ? -30 : W + 30; y = Math.random() * PH; } }
          while (Math.hypot(x - ship.x, y - ship.y) < 150);
          addComet(3, x, y, k);
        }
        const fires = wave >= 3 ? Math.min(4, wave - 2) : 0;
        for (let i = 0; i < fires; i++) addComet(1, Math.random() < 0.5 ? -20 : W + 20, Math.random() * PH, k * 1.3, "fire");
        banner.show("WAVE " + wave, wave === 3 ? "FIREBALLS INCOMING!" : "", "#fff", "#ff3c50", 1.5);
        host.tempo = Math.min(1.35, 1 + (wave - 1) * 0.05);
        Sound.setTempo(host.tempo);
      }

      function wrap(o, m = 0) {
        if (o.x < -m) o.x += W + m * 2; else if (o.x > W + m) o.x -= W + m * 2;
        if (o.y < -m) o.y += PH + m * 2; else if (o.y > PH + m) o.y -= PH + m * 2;
      }

      function crack(c, i) {
        comets.splice(i, 1);
        host.addScore(POINTS[c.size] * (c.kind === "fire" ? 2 : 1));
        fx.burst(c.x, c.y, c.kind === "fire" ? "#ff8a3c" : "#b0a090", 6 + c.size * 6, 80 + c.size * 40, 0.6, S);
        Sound.noise(0.12 + c.size * 0.1, { vol: 0.15 + c.size * 0.07, freq: 3000 - c.size * 600, slide: 200 });
        if (c.size > 1 && c.kind === "rock") {
          const k = 1 + (wave - 1) * 0.1;
          for (let j = 0; j < 2; j++) addComet(c.size - 1, c.x, c.y, k * 1.15);
        } else if (Math.random() < 0.3) {
          crystals.push({ x: c.x, y: c.y, life: 7 });
        }
      }

      function hurt() {
        if (invuln > 0 || dead > 0) return;
        lives--;
        dead = 1.4;
        fx.burst(ship.x, ship.y, "#3cf0ff", 40, 240, 1, S);
        Sound.play("boom");
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        for (const s of stars) { s.b += dt * 0.5; }
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }

        if (dead > 0) {
          dead -= dt;
          if (dead <= 0) {
            if (lives <= 0) { over = true; overT = 0.5; return; }
            Object.assign(ship, { x: W / 2, y: PH / 2, vx: 0, vy: 0, a: -Math.PI / 2 });
            invuln = 2.5; heat = 0; hot = false;
          }
        } else {
          invuln = Math.max(0, invuln - dt);
          if (held.left) ship.a -= 4.2 * dt;
          if (held.right) ship.a += 4.2 * dt;
          if (held.thrust) {
            ship.vx += Math.cos(ship.a) * 280 * dt; ship.vy += Math.sin(ship.a) * 280 * dt;
            if (Math.random() < 0.6) fx.burst(ship.x - Math.cos(ship.a) * ship.r, ship.y - Math.sin(ship.a) * ship.r, Math.random() < 0.5 ? "#ff8a3c" : "#ffd63c", 1, 60, 0.3, S);
          }
          const sp = Math.hypot(ship.vx, ship.vy), max = 290;
          if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }
          const drag = Math.pow(0.55, dt);
          ship.vx *= drag; ship.vy *= drag;
          ship.x += ship.vx * dt; ship.y += ship.vy * dt;
          wrap(ship);

          // the gun: auto-repeat while held, heats up, overheats
          fireT -= dt;
          heat = Math.max(0, heat - dt * (hot ? 0.45 : 0.32));
          if (hot && heat < 0.35) hot = false;
          if (held.fire && fireT <= 0 && !hot) {
            fireT = 0.17;
            const nx = Math.cos(ship.a), ny = Math.sin(ship.a);
            bullets.push({ x: ship.x + nx * ship.r, y: ship.y + ny * ship.r, vx: nx * 520 + ship.vx, vy: ny * 520 + ship.vy, life: 0.85 });
            Sound.tone(1600, 0.06, { vol: 0.07, slide: 700 });
            heat += 0.085;
            if (heat >= 1) { heat = 1; hot = true; Sound.play("lose"); banner.show("OVERHEAT!", "", "#fff", "#ff3c50", 0.8); }
          }
        }

        for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
        bullets = bullets.filter(b => b.life > 0);
        for (const c of comets) {
          if (c.kind === "fire" && dead <= 0) {
            // fireballs steer gently toward you
            const dx = ship.x - c.x, dy = ship.y - c.y, d = Math.hypot(dx, dy) || 1;
            c.vx += (dx / d) * 30 * dt; c.vy += (dy / d) * 30 * dt;
            const sp = Math.hypot(c.vx, c.vy), max = 70 + wave * 6;
            if (sp > max) { c.vx *= max / sp; c.vy *= max / sp; }
            if (Math.random() < 0.3) fx.burst(c.x, c.y, "#ff8a3c", 1, 30, 0.4, S);
          }
          c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.spin * dt;
          wrap(c, c.r);
        }
        for (const k of crystals) k.life -= dt;
        crystals = crystals.filter(k => k.life > 0);

        // bullets crack comets
        for (const b of bullets) {
          for (let i = comets.length - 1; i >= 0; i--) {
            const c = comets[i];
            if (Math.hypot(b.x - c.x, b.y - c.y) < c.r) { b.life = 0; crack(c, i); break; }
          }
        }
        if (dead <= 0) {
          for (const c of comets) if (Math.hypot(ship.x - c.x, ship.y - c.y) < c.r + ship.r * 0.8) { hurt(); break; }
          for (const k of crystals) if (Math.hypot(ship.x - k.x, ship.y - k.y) < ship.r + 12) {
            k.life = 0; host.addScore(150); heat = Math.max(0, heat - 0.5); hot = false; Sound.play("power");
          }
        }
        if (!comets.length) {
          nextWaveT -= dt;
          if (nextWaveT <= 0) {
            if (wave > 0) { host.addScore(250 * wave); Sound.play("bonus"); }
            spawnWave(); nextWaveT = 1.5;
          }
        }
      }

      function draw(g) {
        g.fillStyle = "#03010a"; g.fillRect(0, 0, W, PH);
        for (const s of stars) { g.fillStyle = (Math.sin(s.b * 3) > 0.7) ? "#fff" : "#557"; g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); }
        for (const k of crystals) {
          if (k.life < 2 && Math.floor(t * 10) % 2) continue;
          const r = 8 + Math.sin(t * 6) * 2;
          g.fillStyle = "#4dff7a"; g.globalAlpha = 0.3;
          g.fillRect(k.x - r - 3, k.y - r - 3, r * 2 + 6, r * 2 + 6); g.globalAlpha = 1;
          g.beginPath(); g.moveTo(k.x, k.y - r); g.lineTo(k.x + r * 0.7, k.y); g.lineTo(k.x, k.y + r); g.lineTo(k.x - r * 0.7, k.y); g.closePath(); g.fill();
          g.fillStyle = "#fff"; g.fillRect(k.x - 1, k.y - r / 2, 2, 3);
        }
        for (const c of comets) {
          g.save(); g.translate(Math.round(c.x), Math.round(c.y)); g.rotate(c.rot);
          g.drawImage(c.img, -c.img.width / 2, -c.img.height / 2);
          g.restore();
        }
        g.fillStyle = "#fff";
        for (const b of bullets) g.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
        if (dead <= 0 && (invuln <= 0 || Math.floor(t * 10) % 2)) {
          g.save(); g.translate(Math.round(ship.x), Math.round(ship.y)); g.rotate(ship.a + Math.PI / 2);
          g.drawImage(shipImg, -shipImg.width / 2, -shipImg.height / 2);
          g.restore();
        }
        fx.draw(g);

        // status: lives, wave, heat
        for (let i = 0; i < lives; i++) g.drawImage(shipImg, 6 + i * (shipImg.width * 0.7 + 4), 4, shipImg.width * 0.7, shipImg.height * 0.7);
        Kit.text(g, "WAVE " + Math.max(1, wave), W - 6, 12, 8, "#888", "right");
        Kit.text(g, "HEAT", W / 2 - 46, 12, 7, hot ? "#ff3c50" : "#aaa", "right");
        g.fillStyle = "#222"; g.fillRect(W / 2 - 40, 8, 90, 8);
        g.fillStyle = hot ? (Math.floor(t * 8) % 2 ? "#fff" : "#ff3c50") : heat > 0.7 ? "#ff8a3c" : "#4dff7a";
        g.fillRect(W / 2 - 40, 8, 90 * heat, 8);

        // the button bar (not in Arcade mode, where the deck takes over)
        if (!host.arcade) {
        g.fillStyle = "#0a0614"; g.fillRect(0, PH, W, H - PH);
        g.fillStyle = "#3a1060"; g.fillRect(0, PH, W, 3);
        for (const b of buttons) {
          const on = held[b.id];
          g.fillStyle = on ? b.color : "#1a1028";
          g.fillRect(b.x, b.y, b.w, b.h);
          g.strokeStyle = b.color; g.lineWidth = 2; g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
          Kit.text(g, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.label.length > 2 ? 9 : 22, on ? "#000" : b.color);
        }
        }
        banner.draw(g, W, PH);
      }

      // Each finger presses whichever button it's on; sliding onto another button switches to it.
      function buttonAt(x, y) {
        for (const b of buttons) if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 14 && y <= b.y + b.h + 14) return b.id;
        return null;
      }
      function refreshHeld() {
        for (const k of ["left", "right", "thrust", "fire"]) held[k] = false;
        for (const id of touches.values()) if (id) held[id] = true;
      }
      function down(x, y, id) { const b = buttonAt(x, y); touches.set(id, b); refreshHeld(); if (b) Sound.play("move"); }
      function move(x, y, id) { if (!touches.has(id)) return; touches.set(id, buttonAt(x, y)); refreshHeld(); }
      function up(x, y, id) { touches.delete(id); refreshHeld(); }
      // Arcade mode: joystick left/right turns, up thrusts; FIRE fires, THRUST thrusts
      function arcade() {
        const p = host.pad;
        held.left = p.dir === "left"; held.right = p.dir === "right";
        held.fire = !!p.held.a; held.thrust = p.dir === "up" || !!p.held.b;
      }

      const state = () => ({ wave, lives, comets: comets.map(c => ({ x: c.x, y: c.y, r: c.r, vx: c.vx, vy: c.vy, kind: c.kind })), ship: { ...ship }, heat, hot, dead: dead > 0, over, buttons, held: { ...held } });
      return { update, draw, down, move, up, arcade, state, resize(w, h) { W = w; H = h; layout(); } };
    },
  });
})();
