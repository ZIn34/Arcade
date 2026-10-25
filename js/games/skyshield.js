// SKY SHIELD — meteors are falling on the city. Tap the sky to fire a shield-burst from the cannon:
// it flies to where you tapped and blooms into a glowing bubble that destroys any meteor it touches
// (and a destroyed meteor's blast can catch others). Each wave gives you a limited number of bursts.
// Later waves are faster, and some meteors split in two or zig-zag. Lose every building and it's over.
// Tap where to burst. In Arcade mode: aim with the joystick and press FIRE.
(() => {
  Sound.defineSong("skyshield", {
    bpm: 118,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "G2 . G2 . G2 . A#2 .  G2 . G2 . F2 . D#2 .  G2 . G2 . G2 . A#2 .  C3 . A#2 . F2 . D2 .") },
      { type: "square", vol: 0.07, notes: Sound.notes(
        "D5 - - - A#4 - - -  C5 - - - A4 - G4 -  D5 - - - F5 - - -  D#5 - D5 - C5 - A4 -") },
      { drum: true, vol: 0.15, notes: Sound.notes("k . . h s . . h") },
    ],
  });

  Arcade.addGame("skyshield", {
    music: "skyshield",
    deck: { stick: true, buttons: [{ id: "a", label: "FIRE", color: "#3cf0ff" }] },
    howTo: [
      "TAP THE SKY TO FIRE A SHIELD-BURST",
      "IT BLOOMS WHERE YOU TAPPED",
      "CATCH THE METEORS IN THE BUBBLE",
      "EACH WAVE HAS LIMITED BURSTS",
      "SAVE THE CITY!",
    ],
    arcadeHowTo: [
      "JOYSTICK: AIM",
      "FIRE: FIRE A SHIELD-BURST",
      "CATCH THE METEORS IN THE BUBBLE",
      "EACH WAVE HAS LIMITED BURSTS",
      "SAVE THE CITY!",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const fx = Kit.particles(), banner = Kit.banner();
      const GROUND = () => H - 36;
      let buildings = [], meteors = [], shells = [], blasts = [];
      let wave = 0, toSpawn = 0, spawnT = 0, ammo = 0, t = 0, over = false, overT = 0, betweenT = 1.2;
      const aim = { x: W / 2, y: H * 0.35 };

      function makeCity() {
        buildings = [];
        const n = 6, bw = W / (n + 1);
        for (let i = 0; i < n; i++) {
          const x = bw * (i + 0.5) + (i >= n / 2 ? bw : 0); // a gap in the middle for the cannon
          buildings.push({ x: x - bw * 0.35, w: bw * 0.7, h: Kit.rand(40, 80), alive: true, lights: Array.from({ length: 8 }, () => Math.random() < 0.6) });
        }
      }
      makeCity();
      const cannon = () => ({ x: W / 2, y: GROUND() - 18 });

      function startWave() {
        wave++;
        toSpawn = 6 + wave * 3;
        ammo = Math.round(toSpawn * 1.4) + 4;
        spawnT = 0.5;
        // every third wave one ruined building is rebuilt
        if (wave > 1 && wave % 3 === 1) { const ruined = buildings.find(b => !b.alive); if (ruined) { ruined.alive = true; banner.show("WAVE " + wave, "A BUILDING IS REBUILT!", "#fff", "#4dff7a", 1.6); Sound.play("power"); } else banner.show("WAVE " + wave, "", "#fff", "#3cf0ff", 1.4); }
        else banner.show("WAVE " + wave, wave >= 3 ? "WATCH FOR SPLITTERS!" : "", "#fff", "#3cf0ff", 1.4);
        host.tempo = Math.min(1.35, 1 + (wave - 1) * 0.05);
        Sound.setTempo(host.tempo);
      }

      function spawnMeteor(x, y, tx, kind = "rock", speedK = 1) {
        const ty = GROUND();
        const d = Math.hypot(tx - x, ty - y);
        const sp = (40 + wave * 9) * Kit.rand(0.85, 1.2) * speedK;
        meteors.push({ x, y, sx: x, sy: y, vx: (tx - x) / d * sp, vy: (ty - y) / d * sp, kind, split: kind === "split" ? false : true, t: 0, trail: [] });
      }
      function randomMeteor() {
        const alive = buildings.filter(b => b.alive);
        const target = Math.random() < 0.8 && alive.length ? Kit.pick(alive) : null;
        const tx = target ? target.x + target.w / 2 : Kit.rand(20, W - 20);
        let kind = "rock";
        if (wave >= 3 && Math.random() < Math.min(0.35, 0.1 + wave * 0.03)) kind = "split";
        else if (wave >= 4 && Math.random() < Math.min(0.3, wave * 0.03)) kind = "zig";
        spawnMeteor(Kit.rand(10, W - 10), -10, tx, kind);
      }

      function fire(x, y) {
        if (over || ammo <= 0 || !wave || y > GROUND() - 30) { if (ammo <= 0 && wave) Sound.tone(120, 0.08, { vol: 0.1, type: "sawtooth" }); return; }
        ammo--;
        const c = cannon();
        const d = Math.hypot(x - c.x, y - c.y);
        shells.push({ x: c.x, y: c.y, tx: x, ty: y, vx: (x - c.x) / d * 900, vy: (y - c.y) / d * 900 });
        Sound.tone(900, 0.08, { vol: 0.1, slide: 1600 });
      }

      function blast(x, y, maxR, chain) {
        blasts.push({ x, y, r: 0, max: maxR, t: 0, chain });
        if (!chain) Sound.noise(0.35, { vol: 0.22, freq: 2600, slide: 300 });
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        // Arcade mode: the joystick moves the aim
        if (host.arcade) { aim.x = Kit.clamp(aim.x + host.pad.x * 460 * dt, 10, W - 10); aim.y = Kit.clamp(aim.y + host.pad.y * 460 * dt, 10, GROUND() - 40); }

        if (!toSpawn && !meteors.length) {
          // wave over: bonus for bursts left and buildings standing, then the next one
          if (wave && betweenT === 1.2) {
            const standing = buildings.filter(b => b.alive).length;
            const bonus = ammo * 5 * wave + standing * 100;
            host.addScore(bonus);
            banner.show("WAVE CLEAR", "+" + bonus, "#fff", "#ffd63c", 1);
            Sound.play("bonus");
          }
          betweenT -= dt;
          if (betweenT <= 0) { betweenT = 1.2; startWave(); }
        } else if (toSpawn) {
          spawnT -= dt;
          if (spawnT <= 0) { randomMeteor(); toSpawn--; spawnT = Math.max(0.35, 1.5 - wave * 0.1) * Kit.rand(0.6, 1.4); }
        }

        for (const s of shells) {
          s.x += s.vx * dt; s.y += s.vy * dt;
          if ((s.vy < 0 && s.y <= s.ty) || (s.vy >= 0 && s.y >= s.ty)) { s.done = true; blast(s.tx, s.ty, 48, false); }
        }
        shells = shells.filter(s => !s.done);
        for (const b of blasts) {
          b.t += dt;
          b.r = b.t < 0.3 ? b.max * (b.t / 0.3) : b.max * Math.max(0, 1 - (b.t - 0.3) / 0.35);
        }
        blasts = blasts.filter(b => b.t < 0.65);

        for (const m of meteors) {
          m.t += dt;
          if (m.kind === "zig") m.x += Math.sin(m.t * 3) * 60 * dt;
          m.x += m.vx * dt; m.y += m.vy * dt;
          if (Math.floor(m.t * 30) % 2 === 0) { m.trail.push([m.x, m.y]); if (m.trail.length > 18) m.trail.shift(); }
          // splitters break in two part-way down
          if (m.kind === "split" && !m.split && m.y > H * 0.35) {
            m.split = true; m.dead = true;
            const alive = buildings.filter(b => b.alive);
            for (let k = 0; k < 2; k++) {
              const tg = alive.length ? Kit.pick(alive) : null;
              spawnMeteor(m.x, m.y, tg ? tg.x + tg.w / 2 : Kit.rand(20, W - 20), "rock", 1.1);
            }
            Sound.tone(400, 0.1, { vol: 0.12, slide: 200 });
          }
          // caught in a bubble?
          for (const b of blasts) if (Math.hypot(m.x - b.x, m.y - b.y) < b.r + 4) {
            m.dead = true;
            host.addScore((m.kind === "rock" ? 25 : 50) * wave);
            fx.burst(m.x, m.y, "#ff8a3c", 10, 140, 0.5, 3);
            blast(m.x, m.y, 22, true); // a small blast that can catch others nearby
            break;
          }
          if (!m.dead && m.y >= GROUND()) {
            m.dead = true;
            const hitB = buildings.find(b => b.alive && m.x > b.x - 6 && m.x < b.x + b.w + 6);
            fx.burst(m.x, GROUND(), "#ff3c50", 16, 180, 0.7, 3);
            if (hitB) {
              hitB.alive = false;
              Sound.play("boom");
              if (!buildings.some(b => b.alive)) { over = true; overT = 1.5; banner.show("THE CITY HAS FALLEN", "WAVE " + wave, "#fff", "#ff3c50", 1.6); }
            } else Sound.noise(0.2, { vol: 0.15, freq: 900 });
          }
        }
        meteors = meteors.filter(m => !m.dead);
      }

      function draw(g) {
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#02000c"); grad.addColorStop(1, "#1a0a3a");
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) { g.fillStyle = i % 4 ? "#445" : "#fff"; g.fillRect((i * 89) % W, (i * 47) % (H * 0.7), 2, 2); }
        // meteors with fiery trails
        for (const m of meteors) {
          m.trail.forEach(([x, y], i) => { g.globalAlpha = i / m.trail.length * 0.6; g.fillStyle = "#ff8a3c"; g.fillRect(x - 2, y - 2, 4, 4); });
          g.globalAlpha = 1;
          g.fillStyle = m.kind === "split" ? "#c04cff" : m.kind === "zig" ? "#4dff7a" : "#ffd63c";
          g.fillRect(Math.round(m.x) - 4, Math.round(m.y) - 4, 8, 8);
          g.fillStyle = "#fff"; g.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 2, 3, 3);
        }
        for (const s of shells) {
          g.fillStyle = "#3cf0ff"; g.fillRect(s.x - 2, s.y - 2, 4, 4);
          g.strokeStyle = "rgba(60,240,255,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(s.x - 6, s.ty); g.lineTo(s.x + 6, s.ty); g.stroke();
        }
        for (const b of blasts) {
          g.fillStyle = b.chain ? "#ff8a3c" : "#3cf0ff";
          g.globalAlpha = 0.35; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 0.8; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.stroke();
          g.globalAlpha = 1;
        }
        // the city
        const gy = GROUND();
        g.fillStyle = "#160a2a"; g.fillRect(0, gy, W, H - gy);
        g.fillStyle = "#3cf0ff"; g.fillRect(0, gy, W, 2);
        for (const b of buildings) {
          if (b.alive) {
            g.fillStyle = "#3a2a7a"; g.fillRect(b.x, gy - b.h, b.w, b.h);
            g.fillStyle = "#5a4aaa"; g.fillRect(b.x, gy - b.h, b.w, 3);
            b.lights.forEach((on, i) => { if (on) { g.fillStyle = "#ffd63c"; g.fillRect(b.x + 5 + (i % 2) * (b.w - 16), gy - b.h + 10 + Math.floor(i / 2) * 14, 6, 6); } });
          } else {
            g.fillStyle = "#2a1a20"; g.fillRect(b.x, gy - 12, b.w, 12);
            g.fillStyle = "#ff3c50"; if (Math.floor(t * 4) % 2) g.fillRect(b.x + b.w / 2 - 2, gy - 18, 4, 6);
          }
        }
        const c = cannon();
        g.fillStyle = "#3cf0ff"; g.fillRect(c.x - 16, c.y + 4, 32, 14); g.fillRect(c.x - 4, c.y - 10, 8, 16);
        // aim marker (Arcade mode)
        if (host.arcade) {
          g.strokeStyle = "#fff"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(aim.x - 10, aim.y); g.lineTo(aim.x + 10, aim.y); g.moveTo(aim.x, aim.y - 10); g.lineTo(aim.x, aim.y + 10); g.stroke();
          g.strokeRect(aim.x - 6, aim.y - 6, 12, 12);
        }
        fx.draw(g);
        Kit.text(g, "BURSTS " + ammo, 8, 14, 8, ammo < 4 ? "#ff3c50" : "#3cf0ff", "left");
        Kit.text(g, "WAVE " + Math.max(1, wave), W - 8, 14, 8, "#888", "right");
        banner.draw(g, W, H);
      }

      function down(x, y) { fire(x, y); }
      function arcade(ev) { if (ev.type === "down" && ev.id === "a") fire(aim.x, aim.y); }

      const state = () => ({ wave, ammo, over, buildings: buildings.filter(b => b.alive).length, ground: GROUND(), aim: { ...aim },
        meteors: meteors.map(m => ({ x: m.x, y: m.y, vx: m.vx, vy: m.vy, kind: m.kind })), blasts: blasts.length, shells: shells.length });
      return { update, draw, down, arcade, state, resize(w, h) { W = w; H = h; } };
    },
  });
})();
