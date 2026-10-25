// CAVE COPTER — fly a little copter through an endless twisting cave. Hold to climb, let go to drop.
// Don't touch the cave walls or the rock pillars. Glowing gems are worth bonus points. The cave
// speeds up, narrows and twists harder the further you fly.
// Hold anywhere to climb. In Arcade mode: hold LIFT.
(() => {
  Sound.defineSong("cavecopter", {
    bpm: 126,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "A2 . . A2 . . C3 .  D3 . . D3 . . E3 .  F2 . . F2 . . G2 .  E2 . . E2 . G#2 .") },
      { type: "square", vol: 0.07, notes: Sound.notes(
        "E5 . A5 . C6 . B5 .  A5 . F5 . D5 . E5 .  F5 . A5 . C6 . D6 .  B5 . G#5 . E5 . . .") },
      { drum: true, vol: 0.15, notes: Sound.notes("k . h k s . h .") },
    ],
  });

  const COPTER = [
    "kkkkkkkkkk..",
    ".....k......",
    "...ooooo....",
    "..oowwooo...",
    "koooowwooookk",
    "..ooooooo..k.",
    "...ooooo.....",
    "...k...k.....",
    "..kkkkkkk....",
  ];

  Arcade.addGame("cavecopter", {
    music: "cavecopter",
    deck: { stick: false, buttons: [{ id: "a", label: "LIFT", color: "#ff8a3c" }] },
    howTo: [
      "HOLD ANYWHERE TO CLIMB",
      "LET GO TO DROP",
      "DON'T TOUCH THE WALLS OR PILLARS",
      "GRAB GEMS FOR BONUS POINTS",
      "THE CAVE GETS FASTER AND NARROWER",
    ],
    arcadeHowTo: [
      "HOLD LIFT TO CLIMB",
      "LET GO TO DROP",
      "DON'T TOUCH THE WALLS OR PILLARS",
      "GRAB GEMS FOR BONUS POINTS",
      "THE CAVE GETS FASTER AND NARROWER",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const S = Math.max(2, Math.round(W / 150));
      const copterImg = [0, 1].map(f => Pixel.bake(f ? COPTER.map((r, i) => i === 0 ? "..kkkkkk...." : r) : COPTER, { k: "#333", o: "#ff8a3c", w: "#3cf0ff" }, S));
      const fx = Kit.particles(), banner = Kit.banner();
      const COL = 8;                         // the cave is made of 8px-wide columns
      const cols = [];                       // { top, bot } in screen px for each column
      let scroll = 0, dist = 0, t = 0, over = false, overT = 0, started = false, lifting = false, touches = 0, bonus = 0, lastMark = 0;
      const heli = { x: W * 0.26, y: H * 0.45, vy: 0, w: copterImg[0].width, h: copterImg[0].height };
      let pillars = [], gems = [], center = H / 2, drift = 0;

      const k = () => Math.min(1, dist / 3000);                 // 0 at the start, 1 by 3,000m
      const speed = () => 170 + k() * 230;                       // px per second
      const gap = () => H * (0.66 - k() * 0.32);                 // the cave's height

      function addColumn() {
        // the middle of the cave wanders up and down, more wildly further in
        drift += Kit.rand(-1, 1) * (0.6 + k() * 1.6);
        drift = Kit.clamp(drift, -4 - k() * 4, 4 + k() * 4);
        center += drift;
        const half = gap() / 2;
        center = Kit.clamp(center, half + 16, H - half - 16);
        if (center <= half + 16 || center >= H - half - 16) drift *= -0.5;
        const wob = Kit.rand(-4, 4);
        cols.push({ top: center - half + wob, bot: center + half + wob });
      }
      while (cols.length < Math.ceil(W / COL) + 4) addColumn();
      let pillarIn = 1.4, gemIn = 2;

      const colAt = x => cols[Math.max(0, Math.min(cols.length - 1, Math.floor((x + scroll) / COL)))];

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (!started) { heli.y = H * 0.45 + Math.sin(t * 3) * 6; return; }
        const climb = lifting || (host.arcade && host.pad.held.a);
        heli.vy += (climb ? -1500 : 1100) * dt;
        heli.vy = Kit.clamp(heli.vy, -460, 520);
        heli.y += heli.vy * dt;
        const sp = speed();
        scroll += sp * dt;
        dist += sp * dt / 10;
        while (scroll >= COL) { scroll -= COL; cols.shift(); addColumn(); }
        for (const p of pillars) p.x -= sp * dt;
        for (const gm of gems) gm.x -= sp * dt;
        // pillars and gems come along with the cave
        pillarIn -= dt;
        if (pillarIn <= 0 && dist > 60) {
          const c = cols[cols.length - 1], ph = Kit.rand(0.22, 0.38) * (c.bot - c.top);
          const py = Kit.rand(c.top + 10, c.bot - ph - 10);
          pillars.push({ x: W + 10, y: py, w: 18, h: ph });
          pillarIn = Math.max(0.8, 2.2 - k() * 1.3) * Kit.rand(0.8, 1.2);
        }
        gemIn -= dt;
        if (gemIn <= 0) {
          const c = cols[cols.length - 1];
          gems.push({ x: W + 10, y: Kit.rand(c.top + 24, c.bot - 24) });
          gemIn = Kit.rand(2.5, 4.5);
        }
        pillars = pillars.filter(p => p.x > -40);
        gems = gems.filter(g => g.x > -20 && !g.taken);

        host.setScore(Math.floor(dist) + bonus);
        const mark = Math.floor(dist / 500);
        if (mark > lastMark) { lastMark = mark; banner.show(mark * 500 + "M", "FASTER!", "#fff", "#ff8a3c", 1); Sound.play("bonus"); host.tempo = Math.min(1.4, 1 + mark * 0.05); Sound.setTempo(host.tempo); }

        // crash checks: the copter's body against the walls and pillars
        const box = { x: heli.x + heli.w * 0.15, y: heli.y + heli.h * 0.15, w: heli.w * 0.7, h: heli.h * 0.7 };
        let hit = false;
        for (let x = box.x; x <= box.x + box.w; x += COL / 2) { const c = colAt(x); if (box.y < c.top || box.y + box.h > c.bot) { hit = true; break; } }
        for (const p of pillars) if (Kit.hit(box, p)) hit = true;
        for (const g of gems) if (!g.taken && Kit.hit(box, { x: g.x - 9, y: g.y - 9, w: 18, h: 18 })) { g.taken = true; bonus += 50; Sound.play("power"); fx.burst(g.x, g.y, "#4dff7a", 12, 140, 0.5, 3); }
        if (hit) {
          over = true; overT = 1.2;
          Sound.play("boom");
          fx.burst(heli.x + heli.w / 2, heli.y + heli.h / 2, "#ff8a3c", 40, 260, 1, S);
          banner.show("CRASH!", Math.floor(dist) + "M", "#fff", "#ff3c50", 1.2);
        }
        if (climb && Math.random() < 0.5) fx.burst(heli.x + 2, heli.y + heli.h, "#888", 1, 40, 0.4, 2);
      }

      function draw(g) {
        g.fillStyle = "#1a0e06"; g.fillRect(0, 0, W, H);
        // cave walls: rock above and below the open passage
        for (let i = 0; i < cols.length; i++) {
          const x = Math.round(i * COL - scroll), c = cols[i];
          g.fillStyle = "#5a3418"; g.fillRect(x, 0, COL + 1, c.top); g.fillRect(x, c.bot, COL + 1, H - c.bot);
          g.fillStyle = "#ff8a3c"; g.fillRect(x, c.top - 3, COL + 1, 3); g.fillRect(x, c.bot, COL + 1, 3);
          if (i % 5 === 0) { g.fillStyle = "#3a200c"; g.fillRect(x + 2, c.top - 20, 4, 8); g.fillRect(x + 1, c.bot + 14, 5, 6); }
        }
        for (const p of pillars) {
          g.fillStyle = "#7a4a20"; g.fillRect(Math.round(p.x), Math.round(p.y), p.w, p.h);
          g.fillStyle = "#ff8a3c"; g.fillRect(Math.round(p.x), Math.round(p.y), p.w, 3); g.fillRect(Math.round(p.x), Math.round(p.y + p.h - 3), p.w, 3);
        }
        for (const gm of gems) {
          const r = 8 + Math.sin(t * 6) * 2;
          g.fillStyle = "#4dff7a"; g.globalAlpha = 0.3; g.fillRect(gm.x - r - 3, gm.y - r - 3, r * 2 + 6, r * 2 + 6); g.globalAlpha = 1;
          g.beginPath(); g.moveTo(gm.x, gm.y - r); g.lineTo(gm.x + r * 0.7, gm.y); g.lineTo(gm.x, gm.y + r); g.lineTo(gm.x - r * 0.7, gm.y); g.closePath(); g.fill();
        }
        if (!over) {
          g.save(); g.translate(Math.round(heli.x + heli.w / 2), Math.round(heli.y + heli.h / 2)); g.rotate(Kit.clamp(heli.vy / 1600, -0.25, 0.3));
          g.drawImage(copterImg[Math.floor(t * 20) % 2], -heli.w / 2, -heli.h / 2);
          g.restore();
        }
        fx.draw(g);
        Kit.text(g, Math.floor(dist) + "M", W - 8, 14, 9, "#fff", "right");
        if (!started && Math.floor(t * 2) % 2 === 0) Kit.text(g, host.arcade ? "HOLD LIFT TO FLY" : "HOLD TO FLY", W / 2, H * 0.72, 12, "#fff", "center", "#ff8a3c");
        banner.draw(g, W, H);
      }

      function down() { touches++; lifting = true; if (!started) { started = true; Sound.play("select"); } }
      function up() { touches = Math.max(0, touches - 1); lifting = touches > 0; }
      function arcade(ev) { if (ev.type === "down" && ev.id === "a" && !started) { started = true; Sound.play("select"); } }

      const state = () => ({ started, dist: Math.floor(dist), speed: speed(), gap: gap(), over, heli: { x: heli.x, y: heli.y, vy: heli.vy, w: heli.w, h: heli.h },
        ahead: cols.slice(Math.floor((heli.x + scroll) / COL), Math.floor((heli.x + scroll) / COL) + 30).map(c => ({ top: c.top, bot: c.bot })),
        pillars: pillars.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })), col: COL, lifting: lifting || (host.arcade && !!host.pad.held.a) });
      return { update, draw, down, up, arcade, state, resize(w, h) { W = w; H = h; } };
    },
  });
})();
