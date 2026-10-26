// PIXEL POKER — two ways to play, both with play chips only (arcade coins are never bet; like every
// cabinet it costs 1 coin to start and pays coins for your score).
//   VIDEO POKER: deal 5 cards, tap the ones to hold, draw, and get paid by the pay table. The stake goes
//                up every 8 hands; when you can't cover the stake, it's over.
//   HOLD'EM:     Texas Hold'em against 3 computer players. Fold, check, call or raise. The blinds go up
//                every 5 hands; knock everyone out to clear the table (a new one sits down). Run out of
//                chips and it's over.
// Your score is the chips you've won (your best total above what you started with).
(() => {
  Sound.defineSong("pixelpoker", {
    bpm: 92,
    tracks: [
      { type: "triangle", vol: 0.4, notes: Sound.notes(
        "D2 . A2 . F2 . A2 .  G2 . D3 . A#2 . D3 .  A2 . E3 . C#3 . E3 .  D2 . A2 . F2 . A2 .") },
      { type: "square", vol: 0.06, notes: Sound.notes(
        "F4 - A4 - D5 - - -  D5 - C5 - A#4 - G4 -  E4 - G4 - A4 - C#5 -  D5 - - - - - . .") },
      { drum: true, vol: 0.08, notes: Sound.notes("k . h . s . h h") },
    ],
  });

  // ---------------- cards and hands ----------------
  const RANKS = { 11: "J", 12: "Q", 13: "K", 14: "A", 10: "10" };
  const rankText = r => RANKS[r] || String(r);
  const SUIT_ART = [
    ["...s...", "..sss..", ".sssss.", "sssssss", "sssssss", "..s.s..", ".sssss."],  // spades
    [".ss.ss.", "sssssss", "sssssss", ".sssss.", "..sss..", "...s...", "......."],  // hearts
    ["...s...", "..sss..", ".sssss.", "sssssss", ".sssss.", "..sss..", "...s..."],  // diamonds
    ["..sss..", "..sss..", "ss.s.ss", "sssssss", "ss.s.ss", "...s...", "..sss.."],  // clubs
  ];
  const red = s => s === 1 || s === 2;
  function freshDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // Scores a 5-card hand as one number (bigger is better) plus its category (0 high card .. 8 straight flush).
  function eval5(cards) {
    const rs = cards.map(c => c.r).sort((a, b) => b - a);
    const flush = cards.every(c => c.s === cards[0].s);
    const counts = {};
    for (const r of rs) counts[r] = (counts[r] || 0) + 1;
    const groups = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a);
    let straight = 0;
    if (groups.length === 5) {
      if (rs[0] - rs[4] === 4) straight = rs[0];
      else if (rs[0] === 14 && rs[1] === 5) straight = 5; // A-2-3-4-5
    }
    let cat, ranks;
    const c0 = counts[groups[0]], c1 = counts[groups[1]];
    if (straight && flush) { cat = 8; ranks = [straight]; }
    else if (c0 === 4) { cat = 7; ranks = groups; }
    else if (c0 === 3 && c1 === 2) { cat = 6; ranks = groups; }
    else if (flush) { cat = 5; ranks = rs; }
    else if (straight) { cat = 4; ranks = [straight]; }
    else if (c0 === 3) { cat = 3; ranks = groups; }
    else if (c0 === 2 && c1 === 2) { cat = 2; ranks = groups; }
    else if (c0 === 2) { cat = 1; ranks = groups; }
    else { cat = 0; ranks = rs; }
    let score = cat;
    for (let i = 0; i < 5; i++) score = score * 15 + (ranks[i] || 0);
    return { score, cat, ranks };
  }
  // Best 5 out of 5-7 cards: try every way of leaving cards out.
  function best(cards) {
    const n = cards.length;
    if (n <= 5) return eval5(cards);
    let top = null;
    const pick = (from, chosen) => {
      if (chosen.length === 5) { const e = eval5(chosen.map(i => cards[i])); if (!top || e.score > top.score) top = e; return; }
      for (let i = from; i <= n - (5 - chosen.length); i++) pick(i + 1, chosen.concat(i));
    };
    pick(0, []);
    return top;
  }
  const CAT_NAMES = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];

  // A quick guess at how often `hole` wins against `opponents` random hands, by dealing it out many times.
  function winChance(hole, board, opponents, sims = 160) {
    const known = new Set([...hole, ...board].map(c => c.r * 4 + c.s));
    const rest = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!known.has(r * 4 + s)) rest.push({ r, s });
    let wins = 0;
    for (let k = 0; k < sims; k++) {
      // partial shuffle of just the cards we need
      const need = opponents * 2 + (5 - board.length);
      for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const fullBoard = board.concat(rest.slice(opponents * 2, need));
      const mine = best(hole.concat(fullBoard)).score;
      let beat = true, tie = 0;
      for (let o = 0; o < opponents; o++) {
        const theirs = best([rest[o * 2], rest[o * 2 + 1]].concat(fullBoard)).score;
        if (theirs > mine) { beat = false; break; }
        if (theirs === mine) tie++;
      }
      if (beat) wins += tie ? 1 / (tie + 1) : 1;
    }
    return wins / sims;
  }

  const VP_EVERY = 8; // hands between stake rises
  // Video poker pay table (times the stake), best first.
  const PAYS = [
    ["ROYAL FLUSH", 250], ["STRAIGHT FLUSH", 50], ["FOUR OF A KIND", 25], ["FULL HOUSE", 9],
    ["FLUSH", 6], ["STRAIGHT", 4], ["THREE OF A KIND", 3], ["TWO PAIR", 2], ["JACKS OR BETTER", 1],
  ];
  function vpResult(hand) {
    const e = eval5(hand);
    if (e.cat === 8 && e.ranks[0] === 14) return 0;
    if (e.cat === 8) return 1;
    if (e.cat === 7) return 2;
    if (e.cat === 6) return 3;
    if (e.cat === 5) return 4;
    if (e.cat === 4) return 5;
    if (e.cat === 3) return 6;
    if (e.cat === 2) return 7;
    if (e.cat === 1 && e.ranks[0] >= 11) return 8;
    return -1;
  }

  Arcade.addGame("pixelpoker", {
    music: "pixelpoker",
    deck: { stick: true, buttons: [{ id: "a", label: "SELECT", color: "#4dff7a" }, { id: "b", label: "DEAL / CALL", color: "#ffd63c" }] },
    howTo: [
      "PICK VIDEO POKER OR HOLD'EM",
      "PLAY CHIPS ONLY: COINS ARE NEVER BET",
      "YOUR SCORE IS THE CHIPS YOU WIN",
      "THE STAKES RISE AS YOU PLAY",
      "OUT OF CHIPS AND IT'S OVER",
    ],
    arcadeHowTo: [
      "JOYSTICK: MOVE BETWEEN BUTTONS AND CARDS",
      "SELECT: PRESS THE HIGHLIGHTED ONE",
      "DEAL / CALL: DEAL, DRAW, CHECK OR CALL",
      "PLAY CHIPS ONLY: COINS ARE NEVER BET",
      "YOUR SCORE IS THE CHIPS YOU WIN",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const fx = Kit.particles(), banner = Kit.banner();
      const suitImgs = { normal: SUIT_ART.map((a, s) => Pixel.bake(a, { s: red(s) ? "#e0203a" : "#111" }, 2)), big: SUIT_ART.map((a, s) => Pixel.bake(a, { s: red(s) ? "#e0203a" : "#111" }, 4)) };
      let screen = "menu", t = 0, over = false, overT = 0, ui = [], focus = 0, tip = null;
      let vp = null, he = null;
      const seen = m => localStorage.getItem("crexz-arcade.seen.pixelpoker." + m);
      const markSeen = m => localStorage.setItem("crexz-arcade.seen.pixelpoker." + m, "1");

      // ---------------- drawing helpers ----------------
      function card(g, c, x, y, w, h, opts = {}) {
        const { back = false, held = false, dim = false, glow = false } = opts;
        g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x + 3, y + 4, w, h);
        if (back) {
          g.fillStyle = "#c04cff"; g.fillRect(x, y, w, h);
          g.fillStyle = "#7a14be";
          for (let yy = y + 4; yy < y + h - 4; yy += 6) for (let xx = x + 4 + ((yy / 6) % 2) * 3; xx < x + w - 4; xx += 6) g.fillRect(xx, yy, 3, 3);
          g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
          return;
        }
        g.fillStyle = dim ? "#999" : "#f4f0e8"; g.fillRect(x, y, w, h);
        g.fillStyle = "#d8d0c4"; g.fillRect(x, y + h - 3, w, 3);
        const big = w >= 50;
        const col = red(c.s) ? "#e0203a" : "#111";
        Kit.text(g, rankText(c.r), x + (big ? 6 : 4), y + (big ? 12 : 9), big ? 12 : 8, col, "left");
        const img = (big ? suitImgs.big : suitImgs.normal)[c.s];
        g.drawImage(img, Math.round(x + w / 2 - img.width / 2), Math.round(y + h / 2 - img.height / 2 + (big ? 6 : 4)));
        if (held) {
          g.strokeStyle = "#ffd63c"; g.lineWidth = 4; g.strokeRect(x - 2, y - 2, w + 4, h + 4);
          Kit.text(g, "HELD", x + w / 2, y - 10, 8, "#ffd63c", "center", "#000");
        }
        if (glow) { g.strokeStyle = "#4dff7a"; g.lineWidth = 3; g.strokeRect(x - 1, y - 1, w + 2, h + 2); }
      }
      function drawUI(g) {
        ui.forEach((b, i) => {
          if (b.kind === "card") return;
          const on = b.enabled !== false;
          g.fillStyle = on ? (b.color || "#ffd63c") : "#333";
          g.fillRect(b.x, b.y, b.w, b.h);
          g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(b.x, b.y + b.h - 4, b.w, 4);
          Kit.text(g, b.label, b.x + b.w / 2, b.y + b.h / 2, b.size || 10, on ? "#000" : "#777");
        });
        // the Arcade-mode cursor
        if (host.arcade && ui[focus]) {
          const b = ui[focus];
          g.strokeStyle = Math.floor(t * 4) % 2 ? "#fff" : "#3cf0ff"; g.lineWidth = 3;
          g.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
        }
      }
      const button = (id, label, x, y, w, h, onTap, extra = {}) => ({ id, label, x, y, w, h, onTap, ...extra });

      // ---------------- the mode menu ----------------
      function showMenu() {
        screen = "menu";
        const bw = Math.min(260, W - 60), x = (W - bw) / 2;
        ui = [
          button("vp", "VIDEO POKER", x, H * 0.42, bw, 56, () => pickMode("vp"), { color: "#3cf0ff", size: 12 }),
          button("he", "HOLD'EM", x, H * 0.42 + 76, bw, 56, () => pickMode("he"), { color: "#ff3cc8", size: 12 }),
        ];
        focus = 0;
      }
      function pickMode(m) {
        Sound.play("select");
        if (!seen(m)) { showTip(m); return; }
        if (m === "vp") startVP(); else startHE();
      }
      const TIPS = {
        vp: ["VIDEO POKER", "YOU'RE DEALT 5 CARDS", "TAP CARDS TO HOLD THEM", "DRAW TO SWAP THE REST", "JACKS OR BETTER PAYS", "THE STAKE RISES EVERY 8 HANDS"],
        he: ["HOLD'EM", "2 CARDS EACH, 5 SHARED", "BEST 5 OF YOUR 7 WINS", "FOLD, CHECK, CALL OR RAISE", "KNOCK OUT ALL 3 TO WIN THE TABLE", "THE BLINDS RISE EVERY 5 HANDS"],
      };
      function showTip(m) {
        tip = m;
        const bw = Math.min(220, W - 80);
        ui = [button("ok", "GOT IT!", (W - bw) / 2, H * 0.72, bw, 50, () => { markSeen(m); tip = null; Sound.play("select"); if (m === "vp") startVP(); else startHE(); })];
        focus = 0;
      }

      // ---------------- VIDEO POKER ----------------
      function startVP() {
        screen = "vp";
        vp = { chips: 200, start: 200, peak: 200, stake: 5, hands: 0, deck: null, hand: [], held: [false, false, false, false, false], phase: "bet", result: -1, win: 0 };
        layoutVP();
        banner.show("VIDEO POKER", "STAKE " + vp.stake, "#fff", "#3cf0ff", 1.2);
        host.setScore(0);
      }
      function vpCardRects() {
        const gap = 6, cw = Math.min(64, (W - 20 - gap * 4) / 5), ch = cw * 1.42, y = Math.min(H * 0.5, 34 + Math.min(18, (H * 0.36) / 9) * 9 + 44);
        const x0 = (W - (cw * 5 + gap * 4)) / 2;
        return [0, 1, 2, 3, 4].map(i => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch }));
      }
      function layoutVP() {
        const rects = vpCardRects();
        const bw = Math.min(240, W - 60);
        ui = [];
        if (vp.phase === "hold") rects.forEach((r, i) => ui.push({ id: "c" + i, kind: "card", ...r, onTap: () => toggleHold(i) }));
        const label = vp.phase === "hold" ? "DRAW" : "DEAL  (STAKE " + vp.stake + ")";
        ui.push(button("deal", label, (W - bw) / 2, rects[0].y + rects[0].h + 34, bw, 52, () => vpAction(), { color: "#ffd63c", size: 10, enabled: vp.phase === "hold" || vp.chips >= vp.stake }));
        focus = Math.min(focus, ui.length - 1);
        if (vp.phase !== "hold") focus = ui.length - 1;
      }
      function toggleHold(i) {
        if (vp.phase !== "hold") return;
        vp.held[i] = !vp.held[i];
        Sound.tone(vp.held[i] ? 880 : 520, 0.05, { vol: 0.12 });
      }
      function vpAction() {
        if (over) return;
        if (vp.phase === "hold") {
          // draw: swap every card that isn't held
          for (let i = 0; i < 5; i++) if (!vp.held[i]) vp.hand[i] = vp.deck.pop();
          Sound.noise(0.12, { vol: 0.12, freq: 5000, filter: "highpass" });
          vp.result = vpResult(vp.hand);
          vp.win = vp.result >= 0 ? vp.stake * PAYS[vp.result][1] : 0;
          vp.chips += vp.win;
          vp.peak = Math.max(vp.peak, vp.chips);
          host.setScore(vp.peak - vp.start);
          if (vp.win) {
            banner.show(PAYS[vp.result][0], "+" + vp.win, "#fff", "#ffd63c", 1.4);
            Sound.play(vp.result <= 3 ? "highscore" : "bonus");
            fx.burst(W / 2, H * 0.55, "#ffd63c", 20 + Math.min(40, vp.win / 5), 220, 0.8, 3);
          } else Sound.play("lose");
          vp.phase = "bet";
          vp.hands++;
          if (vp.hands % VP_EVERY === 0) {
            vp.stake += 5;
            setTimeout(() => { if (screen === "vp" && !over) banner.show("STAKE UP!", "NOW " + vp.stake + " A HAND", "#fff", "#ff3cc8", 1.2); }, 1500);
          }
          host.tempo = Math.min(1.3, 1 + vp.hands * 0.01); Sound.setTempo(host.tempo);
          if (vp.chips < vp.stake) { over = true; overT = 2; setTimeout(() => banner.show("OUT OF CHIPS", "BEST " + vp.peak, "#fff", "#ff3c50", 1.6), 900); }
        } else {
          if (vp.chips < vp.stake) return;
          vp.chips -= vp.stake;
          vp.deck = freshDeck();
          vp.hand = [0, 1, 2, 3, 4].map(() => vp.deck.pop());
          vp.held = [false, false, false, false, false];
          vp.result = -1; vp.win = 0;
          vp.phase = "hold";
          Sound.noise(0.15, { vol: 0.12, freq: 5000, filter: "highpass" });
        }
        layoutVP();
      }
      function drawVP(g) {
        // pay table across the top, the winning line lit
        const rowH = Math.min(18, (H * 0.36) / PAYS.length);
        const tx = 14, tw = W - 28, ty = 34;
        g.fillStyle = "#0a1a40"; g.fillRect(tx, ty, tw, rowH * PAYS.length + 8);
        g.strokeStyle = "#3cf0ff"; g.lineWidth = 2; g.strokeRect(tx, ty, tw, rowH * PAYS.length + 8);
        PAYS.forEach(([name, mult], i) => {
          const lit = vp.phase === "bet" && vp.result === i && vp.win;
          const y = ty + 6 + i * rowH + rowH / 2;
          if (lit) { g.fillStyle = Math.floor(t * 6) % 2 ? "#ffd63c" : "#ff8a3c"; g.fillRect(tx + 2, y - rowH / 2, tw - 4, rowH); }
          Kit.text(g, name, tx + 8, y, 8, lit ? "#000" : "#ffd63c", "left");
          Kit.text(g, String(mult * vp.stake), tx + tw - 8, y, 8, lit ? "#000" : "#fff", "right");
        });
        Kit.text(g, "CHIPS " + vp.chips, 14, 18, 10, "#4dff7a", "left");
        Kit.text(g, "STAKE " + vp.stake, W - 14, 18, 10, "#ff3cc8", "right");
        const rects = vpCardRects();
        rects.forEach((r, i) => {
          if (!vp.hand.length) card(g, null, r.x, r.y, r.w, r.h, { back: true });
          else card(g, vp.hand[i], r.x, r.y, r.w, r.h, { held: vp.phase === "hold" && vp.held[i] });
        });
        if (vp.phase === "hold") Kit.text(g, host.arcade ? "SELECT CARDS TO HOLD, THEN DRAW" : "TAP CARDS TO HOLD, THEN DRAW", W / 2, rects[0].y + rects[0].h + 16, 8, "#ddd");
        else if (vp.hand.length && !vp.win) Kit.text(g, "NO WIN", W / 2, rects[0].y + rects[0].h + 16, 8, "#888");
        Kit.text(g, "HANDS " + vp.hands + "  ·  STAKE UP IN " + (VP_EVERY - (vp.hands % VP_EVERY)), W / 2, H - 16, 7, "#888");
      }

      // ---------------- HOLD'EM ----------------
      const CPU_NAMES = [["BYTE", "#3cf0ff"], ["PIXIE", "#ff3cc8"], ["GLITCH", "#4dff7a"], ["NOVA", "#ffd63c"], ["ZAP", "#ff8a3c"], ["RETRO", "#c04cff"]];
      function newCpus() {
        const names = CPU_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        return names.map(([name, color]) => ({ name, color, cpu: true, chips: 1000, hole: [], folded: false, allIn: false, bet: 0, put: 0, out: false, said: "", style: Kit.rand(0.85, 1.25), bluff: Kit.rand(0.04, 0.14) }));
      }
      function startHE() {
        screen = "he";
        he = {
          players: [{ name: "YOU", color: "#fff", cpu: false, chips: 1000, hole: [], folded: false, allIn: false, bet: 0, put: 0, out: false, said: "" }].concat(newCpus()),
          dealer: 0, sb: 10, bb: 20, hands: 0, board: [], deck: null, toAct: 0, current: 0, raises: 0, acted: new Set(), stage: "idle",
          wait: 0, start: 1000, peak: 1000, tables: 0, showdown: null, msg: "",
        };
        host.setScore(0);
        banner.show("HOLD'EM", "BLINDS 10 / 20", "#fff", "#ff3cc8", 1.2);
        he.wait = 1.3;
        he.stage = "next";
        layoutHE();
      }
      const live = () => he.players.filter(p => !p.out);
      const inHand = () => he.players.filter(p => !p.out && !p.folded);
      const canAct = () => he.players.filter(p => !p.out && !p.folded && !p.allIn);
      const nextSeat = i => { let j = i; do { j = (j + 1) % he.players.length; } while (he.players[j].out); return j; };
      const potTotal = () => he.players.reduce((a, p) => a + p.put, 0);
      const heScore = () => Math.floor(Math.max(0, he.peak - he.start) / 10) + he.tables * 100;

      function newHand() {
        const me = he.players[0];
        if (me.chips <= 0) { endHE(); return; }
        // knock out anyone who's broke; a cleared table brings three fresh players
        he.players.forEach(p => { if (p.chips <= 0) p.out = true; });
        if (he.players.slice(1).every(p => p.out)) {
          he.tables++;
          he.players = [me].concat(newCpus());
          banner.show("TABLE CLEARED!", "+100 SCORE · NEW PLAYERS", "#fff", "#4dff7a", 1.8);
          Sound.play("highscore");
          host.setScore(heScore());
        }
        he.hands++;
        if (he.hands > 1 && (he.hands - 1) % 5 === 0) {
          he.sb = Math.round(he.sb * 1.5 / 5) * 5; he.bb = he.sb * 2;
          banner.show("BLINDS UP!", he.sb + " / " + he.bb, "#fff", "#ff3cc8", 1.4);
          Sound.play("power");
          host.tempo = Math.min(1.3, host.tempo ? host.tempo + 0.04 : 1.04); Sound.setTempo(host.tempo);
        }
        he.deck = freshDeck();
        he.board = [];
        he.showdown = null;
        he.msg = "";
        for (const p of he.players) { p.hole = p.out ? [] : [he.deck.pop(), he.deck.pop()]; p.folded = p.out; p.allIn = false; p.bet = 0; p.put = 0; p.said = ""; }
        he.dealer = nextSeat(he.dealer);
        const sbSeat = live().length === 2 ? he.dealer : nextSeat(he.dealer);
        const bbSeat = nextSeat(sbSeat);
        pay(he.players[sbSeat], he.sb); he.players[sbSeat].said = "SMALL BLIND";
        pay(he.players[bbSeat], he.bb); he.players[bbSeat].said = "BIG BLIND";
        he.current = he.bb; he.raises = 0; he.acted = new Set();
        he.toAct = nextSeat(bbSeat);
        he.stage = "preflop";
        he.wait = 0.8;
        Sound.noise(0.2, { vol: 0.12, freq: 5000, filter: "highpass" });
        skipStuck();
        layoutHE();
      }
      function pay(p, n) {
        const amt = Math.min(n, p.chips);
        p.chips -= amt; p.bet += amt; p.put += amt;
        if (p.chips === 0) p.allIn = true;
        return amt;
      }

      // Who still needs to act this round?
      function roundDone() {
        const actors = canAct();
        if (inHand().length <= 1) return true;
        return actors.every(p => he.acted.has(p) && p.bet === he.current);
      }
      function skipStuck() {
        // move toAct past anyone who can't act
        let guard = 0;
        while ((he.players[he.toAct].out || he.players[he.toAct].folded || he.players[he.toAct].allIn) && guard++ < 8) he.toAct = nextSeat(he.toAct);
      }

      function act(p, what) {
        const toCall = he.current - p.bet;
        if (what === "fold") { p.folded = true; p.said = "FOLD"; Sound.tone(200, 0.08, { vol: 0.1, type: "triangle" }); }
        else if (what === "call") {
          if (toCall <= 0) { p.said = "CHECK"; Sound.tone(600, 0.04, { vol: 0.1 }); }
          else { const paid = pay(p, toCall); p.said = p.allIn ? "ALL IN " + paid : "CALL " + paid; Sound.tone(700, 0.05, { vol: 0.12 }); }
        } else if (what === "raise" || what === "allin") {
          let target = what === "allin" ? p.bet + p.chips : he.current + he.bb * 2;
          target = Math.min(target, p.bet + p.chips);
          if (target <= he.current) { act(p, "call"); return; }
          pay(p, target - p.bet);
          he.current = p.bet;
          he.raises++;
          he.acted = new Set();
          p.said = p.allIn ? "ALL IN " + p.bet : "RAISE TO " + p.bet;
          Sound.tone(900, 0.07, { vol: 0.14 }); Sound.tone(1200, 0.07, { vol: 0.12, delay: 0.06 });
        }
        he.acted.add(p);
        advance();
      }

      function advance() {
        if (inHand().length <= 1) { finishHand(); return; }
        if (roundDone()) { nextStreet(); return; }
        he.toAct = nextSeat(he.toAct);
        skipStuck();
        he.wait = he.players[he.toAct].cpu ? Kit.rand(0.5, 0.9) : 0;
        layoutHE();
      }

      function nextStreet() {
        for (const p of he.players) p.bet = 0;
        he.current = 0; he.raises = 0; he.acted = new Set();
        if (he.stage === "preflop") { he.board.push(he.deck.pop(), he.deck.pop(), he.deck.pop()); he.stage = "flop"; }
        else if (he.stage === "flop") { he.board.push(he.deck.pop()); he.stage = "turn"; }
        else if (he.stage === "turn") { he.board.push(he.deck.pop()); he.stage = "river"; }
        else { finishHand(); return; }
        for (const p of he.players) if (!p.folded && !p.out && !p.allIn) p.said = "";
        Sound.noise(0.1, { vol: 0.1, freq: 5000, filter: "highpass" });
        he.toAct = nextSeat(he.dealer);
        skipStuck();
        // if at most one player can still bet, just deal out the rest
        if (canAct().length <= 1) { he.runout = true; he.wait = 0.9; layoutHE(); return; }
        he.wait = he.players[he.toAct].cpu ? 0.7 : 0;
        layoutHE();
      }

      // Pays the pot (with side pots when someone was all in) and shows everyone's hands.
      function finishHand() {
        he.runout = false;
        const contenders = inHand();
        const pot = potTotal();
        const winnings = new Map();
        if (contenders.length === 1) {
          winnings.set(contenders[0], pot);
        } else {
          while (he.board.length < 5) he.board.push(he.deck.pop());
          const hands = new Map(contenders.map(p => [p, best(p.hole.concat(he.board))]));
          const levels = [...new Set(he.players.map(p => p.put).filter(v => v > 0))].sort((a, b) => a - b);
          let prev = 0, carry = 0;
          for (const L of levels) {
            let part = carry;
            for (const p of he.players) part += Math.min(p.put, L) - Math.min(p.put, prev);
            const eligible = contenders.filter(p => p.put >= L);
            if (!eligible.length) { carry = part; prev = L; continue; }
            carry = 0;
            const top = Math.max(...eligible.map(p => hands.get(p).score));
            const winners = eligible.filter(p => hands.get(p).score === top);
            const share = Math.floor(part / winners.length);
            winners.forEach((p, i) => winnings.set(p, (winnings.get(p) || 0) + share + (i === 0 ? part - share * winners.length : 0)));
            prev = L;
          }
          he.showdown = hands;
        }
        for (const [p, n] of winnings) p.chips += n;
        const names = [...winnings.keys()].map(p => p.name);
        const me = he.players[0];
        const myWin = winnings.get(me) || 0;
        let how = "";
        if (he.showdown) { const w = [...winnings.keys()][0]; how = CAT_NAMES[he.showdown.get(w).cat]; }
        he.msg = (names.length > 1 ? "SPLIT: " + names.join(" & ") : names[0] + " WIN" + (names[0] === "YOU" ? "" : "S")) + " " + pot + (how ? " · " + how : "");
        if (myWin > 0) { Sound.play("bonus"); fx.burst(W / 2, H * 0.72, "#ffd63c", 24, 200, 0.8, 3); } else Sound.play(me.folded ? "back" : "lose");
        he.peak = Math.max(he.peak, me.chips);
        host.setScore(heScore());
        for (const p of he.players) { p.bet = 0; }
        he.stage = "result";
        he.wait = he.showdown ? 3.2 : 1.8;
        layoutHE();
      }
      function endHE() {
        over = true; overT = 1.8;
        banner.show("OUT OF CHIPS", "TABLES WON " + he.tables, "#fff", "#ff3c50", 1.6);
        Sound.play("lose");
      }

      // How a computer player decides, from its chance of winning against the others still in.
      function cpuMove(p) {
        const opps = inHand().length - 1;
        const chance = winChance(p.hole, he.board, Math.max(1, opps), he.board.length ? 140 : 110);
        const toCall = he.current - p.bet;
        const pot = potTotal();
        const odds = toCall > 0 ? toCall / (pot + toCall) : 0;
        const fair = 1 / (opps + 1);                     // what an average hand would win
        const strength = chance / fair * p.style;        // >1 means better than average
        const bluffing = Math.random() < p.bluff;
        if (toCall === 0) {
          if ((strength > 1.5 || bluffing) && he.raises < 3) return "raise";
          return "call";
        }
        if (chance < odds * 0.85 && !bluffing) return toCall <= he.bb && Math.random() < 0.35 ? "call" : "fold";
        if (strength > 2.1 && he.raises < 3 && Math.random() < 0.7) return p.chips < he.bb * 4 ? "allin" : "raise";
        if (toCall >= p.chips) return strength > 1.4 ? "call" : "fold";
        return "call";
      }

      function layoutHE() {
        ui = [];
        const me = he.players[0];
        if (he.stage === "result" || he.stage === "next" || over) return;
        const myTurn = he.toAct === 0 && !me.folded && !me.allIn && !he.runout && ["preflop", "flop", "turn", "river"].includes(he.stage);
        if (!myTurn) return;
        const toCall = he.current - me.bet;
        const gap = 6, bw = (W - 16 - gap * 3) / 4, by = H - 62, bh = 50;
        const raiseTo = Math.min(he.current + he.bb * 2, me.bet + me.chips);
        ui = [
          button("fold", "FOLD", 8, by, bw, bh, () => act(me, "fold"), { color: "#ff3c50", size: 9 }),
          button("call", toCall > 0 ? "CALL " + Math.min(toCall, me.chips) : "CHECK", 8 + (bw + gap), by, bw, bh, () => act(me, "call"), { color: "#4dff7a", size: toCall > 999 ? 7 : 8 }),
          button("raise", "RAISE " + raiseTo, 8 + (bw + gap) * 2, by, bw, bh, () => act(me, "raise"), { color: "#ffd63c", size: raiseTo > 999 ? 7 : 8, enabled: he.raises < 3 && me.chips > toCall }),
          button("allin", "ALL IN", 8 + (bw + gap) * 3, by, bw, bh, () => act(me, "allin"), { color: "#ff3cc8", size: 8 }),
        ];
        focus = 1;
      }

      function seatPos(i) {
        // you at the bottom; the three computer players across the top
        if (i === 0) return { x: W / 2, y: H - 168 };
        return { x: W * (0.18 + (i - 1) * 0.32), y: 74 };
      }
      function drawHE(g) {
        // the felt
        g.fillStyle = "#0a3a1e";
        g.beginPath(); g.ellipse(W / 2, H * 0.46, W * 0.48, H * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#7a4a20"; g.lineWidth = 8; g.stroke();
        g.strokeStyle = "#ffd63c"; g.lineWidth = 1; g.globalAlpha = 0.4;
        g.beginPath(); g.ellipse(W / 2, H * 0.46, W * 0.44, H * 0.27, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
        // shared cards and pot
        const cw = Math.min(46, (W - 40) / 5.6), ch = cw * 1.42;
        const bx = W / 2 - (cw * 5 + 4 * 6) / 2, byy = H * 0.42;
        for (let i = 0; i < 5; i++) {
          const c = he.board[i];
          if (c) card(g, c, bx + i * (cw + 6), byy, cw, ch);
          else { g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 2; g.strokeRect(bx + i * (cw + 6), byy, cw, ch); }
        }
        Kit.text(g, "POT " + potTotal(), W / 2, byy - 16, 10, "#ffd63c", "center", "#000");
        Kit.text(g, "BLINDS " + he.sb + "/" + he.bb + " · UP IN " + (5 - ((he.hands - 1 + 5) % 5)), W / 2, byy + ch + 16, 7, "#9c9");
        // players
        he.players.forEach((p, i) => {
          if (i === 0) return;
          const { x, y } = seatPos(i);
          const turn = he.toAct === i && !["result", "next"].includes(he.stage) && !p.folded;
          g.fillStyle = p.out ? "#222" : turn ? "#2a2a50" : "#140a24";
          g.fillRect(x - 56, y - 44, 112, 98);
          g.strokeStyle = p.out ? "#333" : p.color; g.lineWidth = turn ? 3 : 2; g.strokeRect(x - 56, y - 44, 112, 98);
          Kit.text(g, p.name, x, y - 32, 8, p.out ? "#555" : p.color);
          Kit.text(g, p.out ? "OUT" : String(p.chips), x, y - 18, 8, "#fff");
          if (!p.out) {
            const show = he.showdown && !p.folded;
            const cw2 = 30, ch2 = 42;
            card(g, p.hole[0], x - cw2 - 2, y - 8, cw2, ch2, { back: !show, dim: p.folded });
            card(g, p.hole[1], x + 2, y - 8, cw2, ch2, { back: !show, dim: p.folded });
            if (he.dealer === i) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 48, y - 36, 7, 0, Math.PI * 2); g.fill(); Kit.text(g, "D", x + 48, y - 35, 7, "#000"); }
          }
          if (p.said) Kit.text(g, p.said, x, y + 46, 7, p.said === "FOLD" ? "#888" : "#ffd63c");
          if (p.bet) Kit.text(g, String(p.bet), x, y + 64, 8, "#ffd63c", "center", "#000");
        });
        // you
        const me = he.players[0], my = seatPos(0);
        const mcw = Math.min(64, W * 0.17), mch = mcw * 1.42;
        if (me.hole.length) {
          card(g, me.hole[0], W / 2 - mcw - 4, my.y - 10, mcw, mch, { dim: me.folded });
          card(g, me.hole[1], W / 2 + 4, my.y - 10, mcw, mch, { dim: me.folded });
        }
        Kit.text(g, "YOU  " + me.chips, 14, my.y - 22, 10, "#fff", "left", "#ff3cc8");
        if (he.dealer === 0) { g.fillStyle = "#fff"; g.beginPath(); g.arc(W - 24, my.y - 22, 8, 0, Math.PI * 2); g.fill(); Kit.text(g, "D", W - 24, my.y - 21, 7, "#000"); }
        if (me.bet) Kit.text(g, "BET " + me.bet, W - 14, my.y + 4, 8, "#ffd63c", "right");
        if (me.said && he.stage !== "result") Kit.text(g, me.said, 14, my.y + 4, 7, "#ffd63c", "left");
        if (me.hole.length && he.board.length >= 3 && !me.folded) Kit.text(g, CAT_NAMES[best(me.hole.concat(he.board)).cat], W / 2, my.y + mch + 2, 8, "#4dff7a");
        if (he.stage === "result") Kit.text(g, he.msg, W / 2, H - 40, 8, "#fff", "center", "#000");
        else if (he.toAct !== 0 || me.folded || me.allIn || he.runout) Kit.text(g, me.folded ? "YOU FOLDED" : me.allIn ? "YOU'RE ALL IN" : "...", W / 2, H - 40, 8, "#888");
        Kit.text(g, "TABLES WON " + he.tables, W - 14, 16, 7, "#4dff7a", "right");
        Kit.text(g, "HAND " + he.hands, 14, 16, 7, "#888", "left");
      }

      // ---------------- the loop ----------------
      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        // Arcade mode: holding the joystick keeps moving the cursor
        if (host.arcade && host.pad.dir) { repeatT -= dt; if (repeatT <= 0) { moveFocus(host.pad.dir); repeatT = 0.22; } }
        if (screen !== "he") return;
        if (he.wait > 0) { he.wait -= dt; if (he.wait > 0) return; }
        if (he.stage === "next" || he.stage === "result") { newHand(); return; }
        if (he.runout) { // nobody left to bet: deal the rest one card at a time
          if (he.stage === "river") finishHand(); else { nextStreetRunout(); }
          return;
        }
        const p = he.players[he.toAct];
        if (p.cpu && !p.folded && !p.allIn && !p.out) act(p, cpuMove(p));
      }
      function nextStreetRunout() {
        if (he.stage === "preflop") { he.board.push(he.deck.pop(), he.deck.pop(), he.deck.pop()); he.stage = "flop"; }
        else if (he.stage === "flop") { he.board.push(he.deck.pop()); he.stage = "turn"; }
        else if (he.stage === "turn") { he.board.push(he.deck.pop()); he.stage = "river"; }
        Sound.noise(0.1, { vol: 0.1, freq: 5000, filter: "highpass" });
        he.wait = 0.9;
      }

      function draw(g) {
        g.fillStyle = "#06020e"; g.fillRect(0, 0, W, H);
        if (screen === "menu") {
          Kit.text(g, "PIXEL POKER", W / 2, H * 0.2, 20, "#fff", "center", "#ff3cc8");
          Kit.text(g, "PLAY CHIPS ONLY", W / 2, H * 0.2 + 30, 8, "#aaa");
          Kit.text(g, "COINS ARE NEVER BET", W / 2, H * 0.2 + 46, 8, "#aaa");
          if (tip) {
            g.fillStyle = "rgba(0,0,0,.9)"; g.fillRect(16, H * 0.14, W - 32, H * 0.66);
            g.strokeStyle = tip === "vp" ? "#3cf0ff" : "#ff3cc8"; g.lineWidth = 2; g.strokeRect(16, H * 0.14, W - 32, H * 0.66);
            TIPS[tip].forEach((l, i) => Kit.text(g, l, W / 2, H * 0.2 + i * 34, i === 0 ? 14 : 8, i === 0 ? "#fff" : "#ddd", "center", i === 0 ? (tip === "vp" ? "#3cf0ff" : "#ff3cc8") : null));
          }
        } else if (screen === "vp") drawVP(g);
        else drawHE(g);
        drawUI(g);
        fx.draw(g);
        banner.draw(g, W, H);
      }

      // touch: tap a button or a card
      function down(x, y) {
        if (over) return;
        for (const b of ui) if (b.enabled !== false && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.onTap(); return; }
      }
      // Arcade mode: the joystick moves a cursor to the nearest button/card that way
      let repeatT = 0;
      function moveFocus(dir) {
        if (!ui.length) return;
        const cur = ui[Math.min(focus, ui.length - 1)];
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
        let bestI = -1, bestD = 1e9;
        ui.forEach((b, i) => {
          if (i === focus) return;
          const bx = b.x + b.w / 2 - cx, by = b.y + b.h / 2 - cy;
          const along = bx * dx + by * dy;
          if (along <= 4) return;
          const d = along + Math.abs(bx * dy + by * dx) * 2;
          if (d < bestD) { bestD = d; bestI = i; }
        });
        if (bestI >= 0) { focus = bestI; Sound.play("move"); }
      }
      function arcade(ev) {
        if (over) return;
        if (ev.type === "dir" && ev.dir) { moveFocus(ev.dir); repeatT = 0.35; }
        if (ev.type === "down" && ev.id === "a") { const b = ui[focus]; if (b && b.enabled !== false) b.onTap(); }
        if (ev.type === "down" && ev.id === "b") {
          // the main action for the moment: deal / draw, or check / call
          const b = ui.find(x => x.id === "deal" || x.id === "call" || x.id === "ok") || (screen === "menu" && !tip ? ui[focus] : null);
          if (b && b.enabled !== false) b.onTap();
        }
      }

      showMenu();
      const state = () => ({
        screen, over, tip, focus,
        ui: ui.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, enabled: b.enabled !== false })),
        vp: vp && { chips: vp.chips, stake: vp.stake, hands: vp.hands, phase: vp.phase, hand: vp.hand.map(c => ({ ...c })), held: vp.held.slice(), result: vp.result, win: vp.win, peak: vp.peak },
        he: he && { stage: he.stage, toAct: he.toAct, sb: he.sb, bb: he.bb, hands: he.hands, tables: he.tables, board: he.board.map(c => ({ ...c })), current: he.current,
          players: he.players.map(p => ({ name: p.name, chips: p.chips, folded: p.folded, out: p.out, allIn: p.allIn, bet: p.bet, hole: p.cpu ? null : p.hole.map(c => ({ ...c })) })), pot: potTotal(), msg: he.msg },
      });
      return { update, draw, down, arcade, state, resize(w, h) { W = w; H = h; if (screen === "menu") { if (tip) showTip(tip); else showMenu(); } else if (screen === "vp") layoutVP(); else layoutHE(); },
        _test: { eval5, best, winChance, vpResult } };
    },
  });
})();
