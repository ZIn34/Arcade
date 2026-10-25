// BUG BASH — bugs pop out of the garden's holes: bop them before they duck back down. Golden beetles
// are worth extra. Never bop a ladybird! Each bug that gets away, or ladybird you hit, costs a heart.
// Bugs come faster, stay up for less time, and more pop up at once as you go.
// Tap the bugs. In Arcade mode: move the mallet with the joystick and press BOP.
(() => {
  Sound.defineSong("bugbash", {
    bpm: 132,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "C3 . G2 . C3 . G2 .  F2 . C3 . F2 . C3 .  G2 . D3 . G2 . D3 .  C3 . G2 . C3 . E3 .") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "E5 . . G5 . . C6 .  A5 . . F5 . . C5 .  D5 . . G5 . . B5 .  C6 . G5 . E5 . C5 .") },
      { drum: true, vol: 0.14, notes: Sound.notes("k . s . k k s .") },
    ],
  });

  const BUG = [
    "..k....k..",
    "...k..k...",
    "..gggggg..",
    ".gGwGGwGg.",
    "kgGkGGkGgk",
    ".gGGGGGGg.",
    "kgGGGGGGgk",
    ".gGGGGGGg.",
    "k.gggggg.k",
  ];
  const LADY = [
    "....kk....",
    "...kwwk...",
    "..rrkkrr..",
    ".rrkrrkrr.",
    "krrrkkrrrk",
    ".rkrrrrkr.",
    "krrrkkrrrk",
    ".rrrkkrrr.",
    "k.rrrrrr.k",
  ];

  Arcade.addGame("bugbash", {
    music: "bugbash",
    deck: { stick: true, buttons: [{ id: "a", label: "BOP", color: "#4dff7a" }] },
    howTo: [
      "TAP THE BUGS BEFORE THEY HIDE",
      "GOLD BEETLES ARE WORTH MORE",
      "NEVER TAP A LADYBIRD!",
      "A BUG THAT ESCAPES COSTS A HEART",
      "IT GETS FASTER AND BUSIER",
    ],
    arcadeHowTo: [
      "JOYSTICK: MOVE THE MALLET",
      "BOP: BOP THE BUG UNDER IT",
      "GOLD BEETLES ARE WORTH MORE",
      "NEVER BOP A LADYBIRD!",
      "A BUG THAT ESCAPES COSTS A HEART",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const COLS = 3, ROWS = 4;
      let cw, ch, ox, oy;
      function layout() {
        cw = Math.floor(W / COLS);
        ch = Math.floor((H - 60) / ROWS);
        ox = Math.floor((W - cw * COLS) / 2);
        oy = 50;
      }
      layout();
      const S = Math.max(3, Math.floor(Math.min(cw, ch) / 18));
      const imgs = {
        bug: Pixel.bake(BUG, { k: "#222", g: "#1a8a2a", G: "#4dff7a", w: "#fff" }, S),
        gold: Pixel.bake(BUG, { k: "#222", g: "#c08a00", G: "#ffd63c", w: "#fff" }, S),
        lady: Pixel.bake(LADY, { k: "#111", r: "#ff3c50", w: "#fff" }, S),
      };
      const HEART = [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."];
      const heartImg = Pixel.bake(HEART, { r: "#ff3c50" }, 3), heartOff = Pixel.bake(HEART, { r: "#333" }, 3);
      const fx = Kit.particles(), banner = Kit.banner();
      const holes = Array.from({ length: COLS * ROWS }, (_, i) => ({ i, c: i % COLS, r: Math.floor(i / COLS), who: null, t: 0, up: 0, life: 0, bonked: 0 }));
      let hearts = 3, t = 0, popT = 0.8, bopped = 0, over = false, overT = 0, level = 1, cursor = 4, moveT = 0, lastTapAt = 0;

      // the harder it gets: more often, shorter stays, more at once, more ladybirds
      const popEvery = () => Math.max(0.32, 1.0 - level * 0.07);
      const stayFor = () => Math.max(0.55, 1.5 - level * 0.09);
      const maxUp = () => Math.min(5, 1 + Math.floor(level / 2));

      function holeCenter(h) { return { x: ox + h.c * cw + cw / 2, y: oy + h.r * ch + ch * 0.62 }; }

      function pop() {
        const free = holes.filter(h => !h.who);
        if (!free.length || holes.filter(h => h.who).length >= maxUp()) return;
        const h = Kit.pick(free);
        const r = Math.random();
        h.who = r < 0.08 ? "gold" : r < 0.08 + Math.min(0.3, 0.1 + level * 0.025) ? "lady" : "bug";
        h.t = 0; h.life = stayFor() * (h.who === "gold" ? 0.7 : 1); h.bonked = 0;
        Sound.tone(h.who === "lady" ? 900 : 500, 0.05, { vol: 0.08, slide: h.who === "lady" ? 1200 : 700 });
      }

      function loseHeart(why) {
        hearts--;
        Sound.play(why === "lady" ? "boom" : "lose");
        banner.show(why === "lady" ? "NOT THE LADYBIRD!" : "IT GOT AWAY!", hearts > 0 ? hearts + (hearts === 1 ? " HEART LEFT" : " HEARTS LEFT") : "", "#fff", "#ff3c50", 0.9);
        if (hearts <= 0) { over = true; overT = 1.2; }
      }

      function bop(h) {
        if (over) return;
        if (!h.who || h.bonked) { Sound.tone(160, 0.05, { vol: 0.1, type: "triangle" }); return; }
        const p = holeCenter(h);
        if (h.who === "lady") { fx.burst(p.x, p.y - ch * 0.2, "#ff3c50", 14, 160, 0.6, S); h.bonked = 0.3; loseHeart("lady"); return; }
        const pts = h.who === "gold" ? 50 : 10;
        host.addScore(pts * level);
        bopped++;
        h.bonked = 0.3;
        Sound.play(h.who === "gold" ? "bonus" : "hit");
        fx.burst(p.x, p.y - ch * 0.2, h.who === "gold" ? "#ffd63c" : "#4dff7a", 12, 160, 0.5, S);
        if (bopped % 15 === 0) {
          level++;
          banner.show("LEVEL " + level, "FASTER BUGS!", "#fff", "#4dff7a", 1);
          Sound.play("power");
          host.tempo = Math.min(1.4, 1 + (level - 1) * 0.05);
          Sound.setTempo(host.tempo);
        }
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        popT -= dt;
        if (popT <= 0) { pop(); popT = popEvery() * Kit.rand(0.7, 1.3); }
        for (const h of holes) {
          if (!h.who) continue;
          h.t += dt;
          if (h.bonked) { h.bonked -= dt; if (h.bonked <= 0) { h.who = null; h.bonked = 0; } continue; }
          if (h.t > h.life) {
            const was = h.who;
            h.who = null;
            if (was !== "lady") loseHeart("escape");
            if (over) return;
          }
        }
        // Arcade mode: holding the joystick keeps the mallet moving
        if (host.arcade && host.pad.dir) { moveT -= dt; if (moveT <= 0) { stepCursor(host.pad.dir); moveT = 0.16; } }
      }

      function draw(g) {
        g.fillStyle = "#123a16"; g.fillRect(0, 0, W, H);
        // a mown-grass checker
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          g.fillStyle = (r + c) % 2 ? "#164a1c" : "#1a5a22";
          g.fillRect(ox + c * cw, oy + r * ch, cw, ch);
        }
        for (const h of holes) {
          const p = holeCenter(h);
          const hw = cw * 0.62, hh = ch * 0.2;
          // the hole
          g.fillStyle = "#3a2410"; g.fillRect(p.x - hw / 2 - 4, p.y - hh / 2 - 2, hw + 8, hh + 6);
          g.fillStyle = "#0a0402"; g.fillRect(p.x - hw / 2, p.y - hh / 2, hw, hh);
          // who's in it: rises out of the hole, ducks back near the end
          if (h.who) {
            const img = imgs[h.who];
            const rise = Math.min(1, h.t / 0.12) * (h.bonked ? Math.max(0, h.bonked / 0.3) : Math.min(1, (h.life - h.t) / 0.15));
            const y = p.y - img.height * rise;
            g.save();
            g.beginPath(); g.rect(p.x - img.width, p.y - img.height - 20, img.width * 2, img.height + 20); g.clip();
            if (h.bonked && h.who !== "lady") g.globalAlpha = 0.6;
            g.drawImage(img, Math.round(p.x - img.width / 2), Math.round(y));
            g.restore();
            g.globalAlpha = 1;
            if (h.bonked && h.who !== "lady") Kit.text(g, "BOP!", p.x, p.y - img.height - 10, 10, "#fff", "center", "#4dff7a");
          }
          // front lip of the hole, so the bug looks like it's inside
          g.fillStyle = "#5a3a1a"; g.fillRect(p.x - hw / 2 - 4, p.y + hh / 2, hw + 8, 6);
          // the mallet cursor (Arcade mode)
          if (host.arcade && h.i === cursor) {
            g.strokeStyle = "#ffd63c"; g.lineWidth = 3;
            g.strokeRect(ox + h.c * cw + 6, oy + h.r * ch + 6, cw - 12, ch - 12);
            g.fillStyle = "#8a5a30"; g.fillRect(p.x + cw * 0.18, p.y - ch * 0.55, 6, ch * 0.3);
            g.fillStyle = "#c04cff"; g.fillRect(p.x + cw * 0.1, p.y - ch * 0.62, 22, 14);
          }
        }
        fx.draw(g);
        for (let i = 0; i < 3; i++) g.drawImage(i < hearts ? heartImg : heartOff, 6 + i * (heartImg.width + 6), 12);
        Kit.text(g, "LEVEL " + level, W - 8, 22, 8, "#4dff7a", "right");
        banner.draw(g, W, H);
      }

      function holeAt(x, y) {
        const c = Math.floor((x - ox) / cw), r = Math.floor((y - oy) / ch);
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
        return holes[r * COLS + c];
      }
      // touch: a tap bops whatever is in that patch of grass
      function down(x, y) { const h = holeAt(x, y); if (h) bop(h); }

      // Arcade mode: the joystick moves the mallet one hole at a time; BOP bops
      function stepCursor(dir) {
        const c = cursor % COLS, r = Math.floor(cursor / COLS);
        const [dc, dr] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
        cursor = Kit.clamp(r + dr, 0, ROWS - 1) * COLS + Kit.clamp(c + dc, 0, COLS - 1);
        Sound.play("move");
      }
      function arcade(ev) {
        if (ev.type === "dir" && ev.dir) { stepCursor(ev.dir); moveT = 0.3; }
        if (ev.type === "down" && ev.id === "a") bop(holes[cursor]);
      }

      const state = () => ({ hearts, level, bopped, over, cursor, popEvery: popEvery(), stayFor: stayFor(), cols: COLS, cw, ch, ox, oy,
        holes: holes.map(h => ({ i: h.i, who: h.bonked ? null : h.who, left: h.life - h.t, ...holeCenter(h) })) });
      return { update, draw, down, arcade, state, resize(w, h) { W = w; H = h; layout(); } };
    },
  });
})();
