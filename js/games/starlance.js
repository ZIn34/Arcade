// STAR LANCE — hold the line against waves of swooping drones.
// Drag anywhere to fly (the ship moves with your finger but stays above it); the ship fires on its own.
(() => {
  const SHIP = [
    ".....cc.....",
    ".....cc.....",
    "....cwwc....",
    "....cwwc....",
    "...ccbbcc...",
    "..cccbbccc..",
    ".cc.cccc.cc.",
    "cc..cccc..cc",
    "c...p..p...c",
  ];
  const SHIP_PAL = { c: "#3cf0ff", w: "#ffffff", b: "#2060ff", p: "#ff3cc8" };
  const FLAME = ["....y..y....", "....o..o...."];
  const FLAME_PAL = { y: "#ffd63c", o: "#ff8a3c" };

  // Enemies: three kinds, each with two frames. The drone is a one-eyed orb with spinning fins.
  const DRONE = [
    ["....mmmm....", "..mmmmmmmm..", "m.mmwwwwmm.m", "mmmwwkkwwmmm", "mmmwwkkwwmmm", "m.mmwwwwmm.m", "..mmmmmmmm..", "....m..m...."],
    ["....mmmm....", "..mmmmmmmm..", ".mmmwwwwmmm.", "mmmwkkwwwmmm", "mmmwkkwwwmmm", ".mmmwwwwmmm.", "..mmmmmmmm..", "...m....m..."],
  ];
  const DART = [
    ["....oo....", "...oooo...", "..oowwoo..", ".oooooooo.", "oo.oooo.oo", "o...oo...o"],
    ["....oo....", "...oooo...", "..oowwoo..", ".oooooooo.", ".o.oooo.o.", ".o..oo..o."],
  ];
  const GUNNER = [
    ["...gggggg...", "..gggggggg..", ".ggwggggwgg.", "gggggggggggg", "g.gg.gg.gg.g", "g..........g", ".g........g."],
    ["...gggggg...", "..gggggggg..", ".ggwggggwgg.", "gggggggggggg", ".ggg.gg.ggg.", "..g......g..", "..g......g.."],
  ];
  const KINDS = {
    drone: { frames: DRONE, pal: { m: "#ff3cc8", w: "#ffffff", k: "#200020" }, hp: 1, pts: 100, color: "#ff3cc8" },
    dart: { frames: DART, pal: { o: "#ffd63c", w: "#ffffff" }, hp: 1, pts: 150, color: "#ffd63c" },
    gunner: { frames: GUNNER, pal: { g: "#4dff7a", w: "#ffffff" }, hp: 2, pts: 250, color: "#4dff7a" },
  };
  const POWER = {
    twin: { letter: "2", color: "#3cf0ff" },
    rapid: { letter: "R", color: "#ff8a3c" },
    shield: { letter: "S", color: "#4dff7a" },
  };

  Sound.defineSong("starlance", {
    bpm: 138,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "E2 E2 E3 E2 E2 E3 E2 E3  C2 C2 C3 C2 C2 C3 C2 C3  D2 D2 D3 D2 D2 D3 D2 D3  B1 B1 B2 B1 B1 B2 D2 D3") },
      { type: "square", vol: 0.1, notes: Sound.notes(
        "E4 - G4 - B4 - G4 -  A4 - G4 - E4 - D4 -  E4 - G4 - B4 - D5 -  C5 - B4 - A4 - B4 -  " +
        "E5 - D5 - B4 - G4 -  A4 - B4 - G4 - E4 -  F#4 - A4 - B4 - D5 -  B4 - - - - - . .") },
      { drum: true, vol: 0.2, notes: Sound.notes("k . h . s . h k  k . h . s . h h") },
    ],
  });

  Arcade.addGame("starlance", {
    music: "starlance",
    howTo: [
      "DRAG ANYWHERE TO FLY",
      "YOUR SHIP FIRES BY ITSELF",
      "DODGE DRONES AND THEIR SHOTS",
      "GRAB 2, R AND S FOR POWER",
      "3 SHIPS. WAVES GET TOUGHER",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const S = Math.max(2, Math.round(W / 130)); // size of one art pixel
      const shipImg = Pixel.bake(SHIP, SHIP_PAL, S);
      const lifeImg = Pixel.bake(SHIP, SHIP_PAL, Math.max(1, S - 1));
      const flameImg = FLAME.map(r => Pixel.bake([r], FLAME_PAL, S));
      const imgs = {};
      for (const k in KINDS) imgs[k] = KINDS[k].frames.map(f => Pixel.bake(f, KINDS[k].pal, S));

      const fx = Kit.particles(), banner = Kit.banner();
      const ship = { x: W / 2 - shipImg.width / 2, y: H - shipImg.height - 40, w: shipImg.width, h: shipImg.height };
      let deadT = 0, lives = 3, invuln = 2, fireT = 0, wave = 0, t = 0, shake = 0;
      let twin = 0, rapid = 0, shield = 0, nextWaveT = 1.2;
      let bullets = [], shots = [], enemies = [], powers = [];
      let finger = null;
      const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Kit.rand(0.2, 1) }));

      function spawnWave() {
        wave++;
        banner.show("WAVE " + wave, wave === 1 ? "GET READY" : "", "#fff", "#3cf0ff");
        const cols = Math.min(7, 4 + Math.floor(wave / 2));
        const rows = Math.min(5, 2 + Math.floor((wave - 1) / 2));
        const cw = Math.min(W / (cols + 1), 52);
        const left = (W - cw * (cols - 1)) / 2;
        const rowH = Math.max(...Object.values(imgs).map(f => f[0].height)); // every row the same height
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            let kind = "drone";
            if (r === 0 && wave >= 2) kind = "gunner";
            else if (r === rows - 1 && wave >= 3 && c % 2 === 0) kind = "dart";
            const img = imgs[kind][0];
            enemies.push({
              kind, hp: KINDS[kind].hp + (wave >= 6 && kind === "drone" ? 1 : 0),
              slotX: left + c * cw - img.width / 2, slotY: 50 + r * (rowH + 14) + (rowH - img.height) / 2,
              x: W / 2 - img.width / 2 + (c - cols / 2) * 20, y: -60 - r * 40 - c * 12,
              w: img.width, h: img.height, state: "enter", dive: null, flash: 0,
            });
          }
        }
      }

      function fire() {
        const cx = ship.x + ship.w / 2;
        const v = -H * 1.3;
        if (twin > 0) {
          bullets.push({ x: cx - S * 4, y: ship.y + S * 4, vx: -20, vy: v });
          bullets.push({ x: cx + S * 3, y: ship.y + S * 4, vx: 20, vy: v });
        } else {
          bullets.push({ x: cx - S / 2, y: ship.y, vx: 0, vy: v });
        }
        Sound.tone(1200, 0.05, { vol: 0.05, slide: 500 });
      }

      function hurt() {
        if (invuln > 0) return;
        if (shield > 0) { shield = 0; invuln = 1; Sound.play("hit"); return; }
        lives--;
        shake = 0.4;
        fx.burst(ship.x + ship.w / 2, ship.y + ship.h / 2, "#3cf0ff", 40, 260, 1, S);
        Sound.play("boom");
        twin = 0; rapid = 0;
        if (lives <= 0) { lives = 0; ship.dead = true; deadT = 1; return; }
        invuln = 2.2;
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        shake = Math.max(0, shake - dt);
        for (const s of stars) { s.y += s.z * 90 * dt * (1 + wave * 0.05); if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
        if (ship.dead) { deadT -= dt; if (deadT <= 0) host.gameOver(); return; }

        invuln = Math.max(0, invuln - dt);
        twin = Math.max(0, twin - dt); rapid = Math.max(0, rapid - dt); shield = Math.max(0, shield - dt);

        fireT -= dt;
        if (fireT <= 0) { fire(); fireT = rapid > 0 ? 0.11 : 0.24; }

        if (!enemies.length) {
          nextWaveT -= dt;
          if (nextWaveT <= 0) { spawnWave(); nextWaveT = 1.5; }
        }

        const diveChance = Math.min(1.4, 0.25 + wave * 0.12); // dives per second across the swarm
        const sway = Math.sin(t * 0.9) * W * 0.08;
        const shotSpeed = H * (0.35 + Math.min(0.35, wave * 0.03));
        let anyIn = false;
        for (const e of enemies) {
          e.flash = Math.max(0, e.flash - dt);
          const tx = e.slotX + sway, ty = e.slotY;
          if (e.state === "enter") {
            e.x += (tx - e.x) * Math.min(1, dt * 3);
            e.y += (ty - e.y) * Math.min(1, dt * 3);
            if (Math.abs(e.y - ty) < 2) e.state = "form";
          } else if (e.state === "form") {
            anyIn = true;
            e.x = tx; e.y = ty;
            if (e.kind === "gunner" && Math.random() < dt * (0.15 + wave * 0.04)) {
              shots.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: 0, vy: shotSpeed });
            }
          } else if (e.state === "dive") {
            const d = e.dive;
            d.t += dt;
            const speed = e.kind === "dart" ? 1.6 : 1;
            e.y += H * 0.42 * speed * dt * (1 + wave * 0.04);
            const aim = ship.x + ship.w / 2 - e.w / 2;
            e.x += Math.sign(aim - e.x) * Math.min(Math.abs(aim - e.x), W * 0.35 * dt) + Math.sin(d.t * 5) * W * 0.4 * dt;
            if (!d.shot && e.y > H * 0.35 && e.kind !== "dart") {
              d.shot = true;
              shots.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: 0, vy: shotSpeed * 1.2 });
            }
            if (e.y > H + 20) { e.y = -40; e.state = "enter"; }
          }
        }
        // Start dives.
        if (anyIn && Math.random() < dt * diveChance) {
          const ready = enemies.filter(e => e.state === "form");
          if (ready.length) {
            const e = Kit.pick(ready);
            e.state = "dive"; e.dive = { t: 0, shot: false };
            Sound.tone(600, 0.25, { vol: 0.08, slide: 200, type: "triangle" });
          }
        }

        for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
        bullets = bullets.filter(b => b.y > -20);
        for (const s of shots) { s.y += s.vy * dt; }
        shots = shots.filter(s => s.y < H + 10);
        for (const p of powers) { p.y += H * 0.18 * dt; }
        powers = powers.filter(p => p.y < H + 20);

        // Bullets hit enemies.
        for (const b of bullets) {
          for (const e of enemies) {
            if (e.hp > 0 && b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
              b.y = -100;
              e.hp--; e.flash = 0.08;
              if (e.hp <= 0) {
                const k = KINDS[e.kind];
                host.addScore(k.pts * (e.state === "dive" ? 2 : 1));
                fx.burst(e.x + e.w / 2, e.y + e.h / 2, k.color, 16, 180, 0.6, S);
                Sound.noise(0.18, { vol: 0.2, freq: 3000, slide: 300 });
                if (Math.random() < 0.08) {
                  const kind = Kit.pick(Object.keys(POWER));
                  powers.push({ kind, x: e.x + e.w / 2 - 10, y: e.y, w: 20, h: 20 });
                }
              } else Sound.play("bounce");
              break;
            }
          }
        }
        const before = enemies.length;
        enemies = enemies.filter(e => e.hp > 0);
        if (before && !enemies.length) {
          host.addScore(500 * wave);
          Sound.play("bonus");
          banner.show("WAVE CLEAR", "+" + 500 * wave, "#fff", "#ffd63c", 1.2);
          Sound.setTempo(Math.min(1.35, 1 + wave * 0.04));
          host.tempo = Math.min(1.35, 1 + wave * 0.04);
        }

        // Things hitting the ship (a slightly smaller box than the art, to feel fair).
        const hb = { x: ship.x + ship.w * 0.25, y: ship.y + ship.h * 0.2, w: ship.w * 0.5, h: ship.h * 0.7 };
        for (const s of shots) if (s.x > hb.x && s.x < hb.x + hb.w && s.y > hb.y && s.y < hb.y + hb.h) { s.y = H + 100; hurt(); }
        for (const e of enemies) if (e.state === "dive" && Kit.hit(hb, e)) { e.hp = 0; fx.burst(e.x + e.w / 2, e.y + e.h / 2, KINDS[e.kind].color, 16); hurt(); }
        enemies = enemies.filter(e => e.hp > 0);
        for (const p of powers) {
          if (Kit.hit(p, { x: ship.x, y: ship.y, w: ship.w, h: ship.h })) {
            p.y = H + 100;
            if (p.kind === "twin") twin = 12;
            if (p.kind === "rapid") rapid = 10;
            if (p.kind === "shield") shield = 15;
            host.addScore(50);
            Sound.play("power");
          }
        }
      }

      function draw(g) {
        g.save();
        if (shake > 0) g.translate(Kit.rand(-4, 4) * shake * 2, Kit.rand(-4, 4) * shake * 2);
        g.fillStyle = "#02000a";
        g.fillRect(-10, -10, W + 20, H + 20);
        for (const s of stars) {
          g.fillStyle = s.z > 0.7 ? "#fff" : s.z > 0.4 ? "#88a" : "#446";
          g.fillRect(Math.round(s.x), Math.round(s.y), s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 3 : 1);
        }

        const frame = Math.floor(t * 4) % 2;
        for (const e of enemies) {
          const img = imgs[e.kind][frame];
          if (e.flash > 0) { g.globalAlpha = 0.5; }
          g.drawImage(img, Math.round(e.x), Math.round(e.y));
          g.globalAlpha = 1;
        }

        g.fillStyle = "#fff";
        for (const b of bullets) g.fillRect(Math.round(b.x), Math.round(b.y), S, S * 4);
        for (const s of shots) {
          g.fillStyle = (Math.floor(t * 12) % 2) ? "#ff3c50" : "#ffd63c";
          g.fillRect(Math.round(s.x - S / 2), Math.round(s.y), S, S * 3);
        }
        for (const p of powers) {
          const P = POWER[p.kind];
          g.fillStyle = P.color;
          g.globalAlpha = 0.3; g.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6); g.globalAlpha = 1;
          g.fillRect(p.x, p.y, p.w, p.h);
          Kit.text(g, P.letter, p.x + p.w / 2, p.y + p.h / 2 + 1, 10, "#000");
        }

        if (!ship.dead && (invuln <= 0 || Math.floor(t * 10) % 2 === 0)) {
          g.drawImage(flameImg[Math.floor(t * 15) % 2], Math.round(ship.x), Math.round(ship.y + ship.h));
          g.drawImage(shipImg, Math.round(ship.x), Math.round(ship.y));
          if (shield > 0) {
            g.strokeStyle = "#4dff7a";
            g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 10);
            g.lineWidth = 2;
            g.beginPath(); g.arc(ship.x + ship.w / 2, ship.y + ship.h / 2, ship.w * 0.8, 0, Math.PI * 2); g.stroke();
            g.globalAlpha = 1;
          }
        }
        fx.draw(g);
        g.restore();

        Kit.lives(g, lives, 8, H - lifeImg.height - 8, lifeImg);
        Kit.text(g, "WAVE " + Math.max(1, wave), W - 8, H - 14, 8, "#888", "right");
        const tags = [];
        if (twin > 0) tags.push(["TWIN", "#3cf0ff"]);
        if (rapid > 0) tags.push(["RAPID", "#ff8a3c"]);
        if (shield > 0) tags.push(["SHIELD", "#4dff7a"]);
        tags.forEach(([s, c], i) => Kit.text(g, s, 8, 14 + i * 14, 8, c, "left"));
        banner.draw(g, W, H);
      }

      // Relative drag: the ship moves by however far the finger moves, so the finger never hides it.
      function down(x, y) { finger = { x, y }; }
      function move(x, y) {
        if (!finger || ship.dead) return;
        const sens = 1.25;
        ship.x = Kit.clamp(ship.x + (x - finger.x) * sens, 0, W - ship.w);
        ship.y = Kit.clamp(ship.y + (y - finger.y) * sens, H * 0.45, H - ship.h - 30);
        finger = { x, y };
      }
      function up() { finger = null; }
      function resize(w, h) {
        W = w; H = h;
        ship.x = Kit.clamp(ship.x, 0, W - ship.w);
        ship.y = Kit.clamp(ship.y, H * 0.45, H - ship.h - 30);
      }

      // A read-out of the game's state, used by the automatic tests.
      const state = () => ({ wave, lives, ship: { x: ship.x + ship.w / 2, y: ship.y }, dead: !!ship.dead,
        enemies: enemies.map(e => ({ x: e.x + e.w / 2, y: e.y + e.h / 2, dive: e.state === "dive" })),
        shots: shots.map(s => ({ x: s.x, y: s.y })) });
      return { update, draw, down, move, up, resize, state };
    },
  });
})();
