// PIXEL POKER — Texas Hold'em against 3 computer players, with play chips only (arcade coins are never
// bet; like every cabinet it costs 1 coin to start and pays coins for your score).
// Each turn you FOLD, CHECK (or CALL a bet) or RAISE, and a raise lets you choose the amount. The blinds go
// up every 5 hands. Knock all three out to clear the table (fresh players sit down); run out of chips and
// it's over. Your score is the chips you've won (your best total above 1,000, in tenths) plus 100 a table.
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

  const CPU_NAMES = [["BYTE", "#3cf0ff"], ["PIXIE", "#ff3cc8"], ["GLITCH", "#4dff7a"], ["NOVA", "#ffd63c"], ["ZAP", "#ff8a3c"], ["RETRO", "#c04cff"]];

  Arcade.addGame("pixelpoker", {
    music: "pixelpoker",
    deck: { stick: true, buttons: [{ id: "a", label: "SELECT", color: "#4dff7a" }, { id: "b", label: "CHECK / CALL", color: "#ffd63c" }] },
    howTo: [
      "TEXAS HOLD'EM VS 3 PLAYERS",
      "2 CARDS EACH, 5 SHARED: BEST 5 WINS",
      "FOLD, CHECK / CALL, OR RAISE",
      "RAISE LETS YOU PICK THE AMOUNT",
      "THE BLINDS RISE EVERY 5 HANDS",
      "PLAY CHIPS ONLY: COINS ARE NEVER BET",
    ],
    arcadeHowTo: [
      "JOYSTICK: MOVE BETWEEN BUTTONS",
      "SELECT: PRESS THE HIGHLIGHTED BUTTON",
      "CHECK / CALL: CHECK OR CALL AT ONCE",
      "RAISE LETS YOU PICK THE AMOUNT",
      "THE BLINDS RISE EVERY 5 HANDS",
      "PLAY CHIPS ONLY: COINS ARE NEVER BET",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const fx = Kit.particles(), banner = Kit.banner();
      const suitImgs = { normal: SUIT_ART.map((a, s) => Pixel.bake(a, { s: red(s) ? "#e0203a" : "#111" }, 2)), big: SUIT_ART.map((a, s) => Pixel.bake(a, { s: red(s) ? "#e0203a" : "#111" }, 4)) };
      let t = 0, over = false, overT = 0, ui = [], focus = 0, dragging = false;

      // ---------------- drawing helpers ----------------
      function card(g, c, x, y, w, h, opts = {}) {
        const { back = false, dim = false, glow = false } = opts;
        g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x + 3, y + 4, w, h);
        if (back || !c) {
          g.fillStyle = "#c04cff"; g.fillRect(x, y, w, h);
          g.fillStyle = "#7a14be";
          for (let yy = y + 4; yy < y + h - 4; yy += 6) for (let xx = x + 4 + ((yy / 6) % 2) * 3; xx < x + w - 4; xx += 6) g.fillRect(xx, yy, 3, 3);
          if (w > 8) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, w - 4, h - 4); }
          return;
        }
        g.fillStyle = dim ? "#8a8680" : "#f4f0e8"; g.fillRect(x, y, w, h);
        g.fillStyle = "#d8d0c4"; g.fillRect(x, y + h - 3, w, 3);
        if (w < 14) return; // mid-flip: too thin for the face
        const big = w >= 50;
        const col = red(c.s) ? "#e0203a" : "#111";
        Kit.text(g, rankText(c.r), x + (big ? 6 : 4), y + (big ? 12 : 9), big ? 12 : 8, col, "left");
        const img = (big ? suitImgs.big : suitImgs.normal)[c.s];
        g.drawImage(img, Math.round(x + w / 2 - img.width / 2), Math.round(y + h / 2 - img.height / 2 + (big ? 6 : 4)));
        if (glow) { g.strokeStyle = "#ffd63c"; g.lineWidth = 3; g.strokeRect(x - 2, y - 2, w + 4, h + 4); }
      }
      function drawUI(g) {
        ui.forEach(b => {
          if (b.kind === "slider") return;
          const on = b.enabled !== false;
          g.fillStyle = on ? (b.color || "#ffd63c") : "#333";
          g.fillRect(b.x, b.y, b.w, b.h);
          g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(b.x, b.y, b.w, 3);
          g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(b.x, b.y + b.h - 4, b.w, 4);
          Kit.text(g, b.label, b.x + b.w / 2, b.y + b.h / 2, b.size || 10, on ? "#000" : "#777");
        });
        if (host.arcade && ui[focus]) {
          const b = ui[focus];
          g.strokeStyle = Math.floor(t * 4) % 2 ? "#fff" : "#3cf0ff"; g.lineWidth = 3;
          g.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
        }
      }
      const button = (id, label, x, y, w, h, onTap, extra = {}) => ({ id, label, x, y, w, h, onTap, ...extra });

      // ---------------- animation helpers ----------------
      // Cards slide in from the deck and flip face up; chip stacks fly between seats, the pot and your counter.
      const flights = [];       // chip stacks in the air
      const dealt = new Map();  // card -> the moment it was dealt
      const deckAt = () => ({ x: W / 2 - 20, y: H * 0.3 });
      function dealCard(c, delay = 0) { if (c) dealt.set(c, t + delay); }
      function cardAnim(c, x, y) {
        const t0 = dealt.get(c);
        if (t0 == null) return { x, y, k: 1, flip: 1 };
        const k = Kit.clamp((t - t0) / 0.28, 0, 1);
        const e = 1 - (1 - k) * (1 - k);
        const d = deckAt();
        return { x: d.x + (x - d.x) * e, y: d.y + (y - d.y) * e, k, flip: Kit.clamp((t - t0 - 0.28) / 0.2, 0, 1) };
      }
      // draws a card where it is in its deal: sliding (face down), then flipping over
      function drawCard(g, c, x, y, w, h, opts = {}) {
        if (!c) { card(g, c, x, y, w, h, opts); return; }
        const a = cardAnim(c, x, y);
        if (a.k <= 0) return;
        if (opts.back || a.k < 1) { card(g, c, a.x, a.y, w, h, { ...opts, back: true }); return; }
        const squash = Math.max(0.06, Math.abs(Math.cos(a.flip * Math.PI)));
        const ww = w * (a.flip >= 1 ? 1 : squash);
        card(g, c, a.x + (w - ww) / 2, a.y, ww, h, { ...opts, back: a.flip < 0.5 });
      }
      function flyChips(x0, y0, x1, y1, n, delay = 0, color = "#ffd63c") {
        if (n > 0) flights.push({ x0, y0, x1, y1, t0: t + delay, dur: 0.45, n, color });
      }
      function chipStack(g, x, y, n, color = "#ffd63c") {
        const count = Math.min(6, 1 + Math.floor(Math.log10(Math.max(1, n)) * 1.6));
        for (let i = 0; i < count; i++) {
          g.fillStyle = "#000"; g.fillRect(x - 8, y - i * 3 + 1, 16, 4);
          g.fillStyle = i % 2 ? "#ffffff" : color; g.fillRect(x - 8, y - i * 3, 16, 3);
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x - 3, y - i * 3, 6, 3);
        }
      }
      function drawFlights(g) {
        for (let i = flights.length - 1; i >= 0; i--) {
          const f = flights[i], k = (t - f.t0) / f.dur;
          if (k < 0) continue;
          if (k >= 1) { flights.splice(i, 1); continue; }
          const e = k * k * (3 - 2 * k);
          chipStack(g, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 34, f.n, f.color);
        }
      }

      // ---- your chips, in the top-right corner: the number counts up or down and flashes when it changes ----
      const meter = { shown: 0, target: 0, flash: 0, color: "#4dff7a", pops: [] };
      const meterBox = () => ({ x: W - 148, y: 6, w: 140, h: 42 });
      function setMeter(n, instant) {
        if (instant) { meter.shown = n; meter.target = n; meter.pops = []; return; }
        const diff = n - meter.target;
        if (diff) {
          meter.flash = 0.7; meter.color = diff > 0 ? "#4dff7a" : "#ff3c50";
          meter.pops.push({ text: (diff > 0 ? "+" : "") + diff, t: 0, color: meter.color });
          if (diff > 0) Sound.tone(Sound.N(84), 0.05, { vol: 0.08 });
        }
        meter.target = n;
      }
      function updateMeter(dt) {
        const d = meter.target - meter.shown;
        if (Math.abs(d) < 1) meter.shown = meter.target;
        else meter.shown += Math.sign(d) * Math.max(Math.abs(d) * Math.min(1, dt * 5), Math.min(Math.abs(d), dt * 60));
        meter.flash = Math.max(0, meter.flash - dt);
        for (const p of meter.pops) p.t += dt;
        meter.pops = meter.pops.filter(p => p.t < 1.3);
      }
      function drawMeter(g, label) {
        const b = meterBox();
        const lit = meter.flash > 0 && Math.floor(meter.flash * 12) % 2;
        g.fillStyle = "#0a0614"; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = lit ? meter.color : "#ffd63c"; g.lineWidth = 2; g.strokeRect(b.x, b.y, b.w, b.h);
        g.globalAlpha = 0.25; g.strokeStyle = "#ffd63c"; g.lineWidth = 6; g.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); g.globalAlpha = 1;
        chipStack(g, b.x + 18, b.y + 30, 100000);
        Kit.text(g, label, b.x + 36, b.y + 12, 7, "#aaa", "left");
        Kit.text(g, String(Math.round(meter.shown)), b.x + 36, b.y + 29, 13, meter.flash > 0 ? meter.color : "#fff", "left");
        for (const p of meter.pops) {
          g.globalAlpha = Math.max(0, 1 - p.t / 1.3);
          Kit.text(g, p.text, b.x + b.w - 6, b.y + b.h + 14 - p.t * 10, 10, p.color, "right", "#000");
        }
        g.globalAlpha = 1;
      }
      const meterAt = () => { const b = meterBox(); return { x: b.x + 18, y: b.y + 30 }; };

      // ---------------- the table ----------------
      function newCpus() {
        const names = CPU_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        return names.map(([name, color]) => ({ name, color, cpu: true, chips: 1000, hole: [], folded: false, allIn: false, bet: 0, put: 0, out: false, said: "", style: Kit.rand(0.85, 1.25), bluff: Kit.rand(0.04, 0.14) }));
      }
      const he = {
        players: [{ name: "YOU", color: "#fff", cpu: false, chips: 1000, hole: [], folded: false, allIn: false, bet: 0, put: 0, out: false, said: "" }].concat(newCpus()),
        dealer: 0, sb: 10, bb: 20, hands: 0, board: [], deck: null, toAct: 0, current: 0, lastRaise: 20, raises: 0, acted: new Set(), stage: "next",
        wait: 1.3, waitMax: 1.3, start: 1000, peak: 1000, tables: 0, showdown: null, msg: "", winners: new Set(), picker: null, runout: false,
      };
      setMeter(1000, true);
      banner.show("HOLD'EM", "BLINDS 10 / 20", "#fff", "#ff3cc8", 1.2);

      const live = () => he.players.filter(p => !p.out);
      const inHand = () => he.players.filter(p => !p.out && !p.folded);
      const canAct = () => he.players.filter(p => !p.out && !p.folded && !p.allIn);
      const nextSeat = i => { let j = i; do { j = (j + 1) % he.players.length; } while (he.players[j].out); return j; };
      const potTotal = () => he.players.reduce((a, p) => a + p.put, 0);
      const heScore = () => Math.floor(Math.max(0, he.peak - he.start) / 10) + he.tables * 100;
      const me = () => he.players[0];

      // where things are on the table
      function seatPos(i) {
        if (i === 0) return { x: W / 2, y: H - 172 };
        return { x: W * (0.18 + (i - 1) * 0.32), y: 112 };
      }
      const betSpot = i => { const s = seatPos(i); return i === 0 ? { x: W / 2 - Math.min(64, W * 0.17) - 46, y: s.y + 40 } : { x: s.x, y: s.y + 70 }; };
      const boardGeom = () => { const cw = Math.min(46, (W - 40) / 5.6), ch = cw * 1.42; return { cw, ch, x: W / 2 - (cw * 5 + 4 * 6) / 2, y: H * 0.44 }; };
      const potSpot = () => { const b = boardGeom(); return { x: W / 2, y: b.y - 22 }; };
      const setWait = s => { he.wait = s; he.waitMax = Math.max(0.01, s); };
      // it's your turn once everything in front of you has finished dealing
      const myTurnNow = () => { const p0 = me(); return he.toAct === 0 && !p0.folded && !p0.allIn && !he.runout && he.wait <= 0 && ["preflop", "flop", "turn", "river"].includes(he.stage); };

      function newHand() {
        const p0 = me();
        if (p0.chips <= 0) { endHE(); return; }
        he.players.forEach(p => { if (p.chips <= 0) p.out = true; });
        if (he.players.slice(1).every(p => p.out)) {
          he.tables++;
          he.players = [p0].concat(newCpus());
          banner.show("TABLE CLEARED!", "+100 SCORE · NEW PLAYERS", "#fff", "#4dff7a", 1.8);
          Sound.play("highscore");
          host.setScore(heScore());
        }
        he.hands++;
        if (he.hands > 1 && (he.hands - 1) % 5 === 0) {
          he.sb = Math.round(he.sb * 1.5 / 5) * 5; he.bb = he.sb * 2;
          banner.show("BLINDS UP!", he.sb + " / " + he.bb, "#fff", "#ff3cc8", 1.4);
          Sound.play("power");
          host.tempo = Math.min(1.3, (host.tempo || 1) + 0.04); Sound.setTempo(host.tempo);
        }
        he.deck = freshDeck();
        he.board = [];
        he.showdown = null; he.msg = ""; he.winners = new Set(); he.picker = null;
        for (const p of he.players) { p.hole = p.out ? [] : [he.deck.pop(), he.deck.pop()]; p.folded = p.out; p.allIn = false; p.bet = 0; p.put = 0; p.said = ""; }
        he.dealer = nextSeat(he.dealer);
        // deal round the table, one card at a time
        let k = 0;
        for (let round = 0; round < 2; round++) {
          let s = nextSeat(he.dealer);
          for (let n = 0; n < live().length; n++) { dealCard(he.players[s].hole[round], 0.15 + k * 0.11); k++; s = nextSeat(s); }
        }
        const sbSeat = live().length === 2 ? he.dealer : nextSeat(he.dealer);
        const bbSeat = nextSeat(sbSeat);
        pay(sbSeat, he.sb); he.players[sbSeat].said = "SMALL BLIND";
        pay(bbSeat, he.bb); he.players[bbSeat].said = "BIG BLIND";
        he.current = he.bb; he.lastRaise = he.bb; he.raises = 0; he.acted = new Set();
        he.toAct = nextSeat(bbSeat);
        he.stage = "preflop";
        setWait(0.65 + k * 0.11); // until the last card has landed and flipped
        Sound.noise(0.2, { vol: 0.12, freq: 5000, filter: "highpass" });
        skipStuck();
        layoutHE();
      }
      // puts chips in front of a player, with a little stack flying from their seat
      function pay(i, n) {
        const p = he.players[i];
        const amt = Math.min(n, p.chips);
        p.chips -= amt; p.bet += amt; p.put += amt;
        if (p.chips === 0) p.allIn = true;
        const from = i === 0 ? meterAt() : seatPos(i), to = betSpot(i);
        flyChips(from.x, from.y, to.x, to.y, amt);
        if (i === 0) setMeter(p.chips);
        return amt;
      }

      function roundDone() {
        if (inHand().length <= 1) return true;
        return canAct().every(p => he.acted.has(p) && p.bet === he.current);
      }
      function skipStuck() {
        let guard = 0;
        while ((he.players[he.toAct].out || he.players[he.toAct].folded || he.players[he.toAct].allIn) && guard++ < 8) he.toAct = nextSeat(he.toAct);
      }
      const minRaiseTo = p => Math.min(he.current + Math.max(he.bb, he.lastRaise), p.bet + p.chips);

      // what = "fold" | "call" (checks when there's nothing to call) | "raise" (to `target`)
      function act(i, what, target) {
        const p = he.players[i];
        const toCall = he.current - p.bet;
        if (what === "fold") { p.folded = true; p.said = "FOLD"; Sound.tone(200, 0.08, { vol: 0.1, type: "triangle" }); }
        else if (what === "call") {
          if (toCall <= 0) { p.said = "CHECK"; Sound.tone(600, 0.04, { vol: 0.1 }); }
          else { const paid = pay(i, toCall); p.said = p.allIn ? "ALL IN " + paid : "CALL " + paid; Sound.tone(700, 0.05, { vol: 0.12 }); }
        } else if (what === "raise") {
          target = Math.min(Math.max(target || minRaiseTo(p), minRaiseTo(p)), p.bet + p.chips);
          if (target <= he.current) { act(i, "call"); return; }
          const before = he.current;
          pay(i, target - p.bet);
          he.current = p.bet;
          he.lastRaise = Math.max(he.bb, he.current - before);
          he.raises++;
          he.acted = new Set();
          p.said = p.allIn ? "ALL IN " + p.bet : (before ? "RAISE TO " : "BET ") + p.bet;
          Sound.tone(900, 0.07, { vol: 0.14 }); Sound.tone(1200, 0.07, { vol: 0.12, delay: 0.06 });
        }
        he.acted.add(p);
        he.picker = null;
        advance();
      }

      function advance() {
        if (inHand().length <= 1) { finishHand(); return; }
        if (roundDone()) { nextStreet(); return; }
        he.toAct = nextSeat(he.toAct);
        skipStuck();
        setWait(he.players[he.toAct].cpu ? Kit.rand(0.7, 1.1) : 0);
        layoutHE();
      }

      // gather the bets into the pot, then the next shared cards
      function gatherBets() {
        const pot = potSpot();
        he.players.forEach((p, i) => { if (p.bet) { const b = betSpot(i); flyChips(b.x, b.y, pot.x, pot.y, p.bet); } p.bet = 0; });
      }
      function dealBoard(n) {
        for (let k = 0; k < n; k++) { const c = he.deck.pop(); he.board.push(c); dealCard(c, 0.35 + k * 0.14); }
      }
      function nextStreet() {
        gatherBets();
        he.current = 0; he.lastRaise = he.bb; he.raises = 0; he.acted = new Set();
        if (he.stage === "preflop") { dealBoard(3); he.stage = "flop"; }
        else if (he.stage === "flop") { dealBoard(1); he.stage = "turn"; }
        else if (he.stage === "turn") { dealBoard(1); he.stage = "river"; }
        else { finishHand(); return; }
        for (const p of he.players) if (!p.folded && !p.out && !p.allIn) p.said = "";
        Sound.noise(0.1, { vol: 0.1, freq: 5000, filter: "highpass" });
        he.toAct = nextSeat(he.dealer);
        skipStuck();
        if (canAct().length <= 1) { he.runout = true; setWait(1.2); layoutHE(); return; }
        setWait(he.players[he.toAct].cpu ? 1.1 : 0.7);
        layoutHE();
      }

      // pays the pot (with side pots when someone was all in) and shows everyone's hands
      function finishHand() {
        he.runout = false;
        gatherBets();
        const contenders = inHand();
        const pot = potTotal();
        const winnings = new Map();
        if (contenders.length === 1) {
          winnings.set(contenders[0], pot);
        } else {
          const missing = 5 - he.board.length;
          if (missing > 0) dealBoard(missing);
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
        // the pot flies to whoever won it
        const from = potSpot();
        for (const [p, n] of winnings) {
          p.chips += n;
          he.winners.add(p);
          const i = he.players.indexOf(p), to = i === 0 ? meterAt() : seatPos(i);
          flyChips(from.x, from.y, to.x, to.y, n, 0.5, "#ffd63c");
        }
        const p0 = me();
        setTimeout(() => setMeter(p0.chips), 900);
        const names = [...winnings.keys()].map(p => p.name);
        let how = "";
        if (he.showdown) { const w = [...winnings.keys()][0]; how = CAT_NAMES[he.showdown.get(w).cat]; }
        he.msg = (names.length > 1 ? "SPLIT: " + names.join(" & ") : names[0] === "YOU" ? "YOU WIN" : names[0] + " WINS") + " " + pot + (how ? " · " + how : "");
        if (winnings.get(p0)) { Sound.play("bonus"); fx.burst(W / 2, seatPos(0).y, "#ffd63c", 24, 200, 0.8, 3); } else Sound.play(p0.folded ? "back" : "lose");
        he.peak = Math.max(he.peak, p0.chips);
        host.setScore(heScore());
        he.stage = "result";
        setWait(he.showdown ? 3.6 : 2.2);
        layoutHE();
      }
      function endHE() {
        over = true; overT = 1.8;
        banner.show("OUT OF CHIPS", "TABLES WON " + he.tables, "#fff", "#ff3c50", 1.6);
        Sound.play("lose");
      }

      // How a computer player decides, from its chance of winning against the others still in.
      function cpuMove(i) {
        const p = he.players[i];
        const opps = inHand().length - 1;
        const chance = winChance(p.hole, he.board, Math.max(1, opps), he.board.length ? 140 : 110);
        const toCall = he.current - p.bet, pot = potTotal();
        const odds = toCall > 0 ? toCall / (pot + toCall) : 0;
        const strength = chance * (opps + 1) * p.style; // >1 means better than an average hand
        const bluffing = Math.random() < p.bluff;
        // raise sizes: a little for so-so hands, more for strong ones
        const sizeTo = () => {
          const k = strength > 2.6 ? Kit.pick([0.5, 0.66, 0.75]) : Kit.pick([0.33, 0.4, 0.5]);
          return Math.round((he.current + Math.max(he.bb, pot * k)) / 5) * 5;
        };
        if (toCall === 0) {
          if ((strength > 1.7 || bluffing) && he.raises < 2) return ["raise", sizeTo()];
          return ["call"];
        }
        if (chance < odds * 0.85 && !bluffing) return toCall <= he.bb && Math.random() < 0.35 ? ["call"] : ["fold"];
        if (strength > 2.4 && he.raises < 3 && Math.random() < 0.6) return ["raise", p.chips < he.bb * 4 ? p.bet + p.chips : sizeTo()];
        if (toCall >= p.chips) return strength > 1.4 ? ["call"] : ["fold"];
        return ["call"];
      }

      // ---------------- your buttons, and the raise picker ----------------
      function layoutHE() {
        ui = [];
        const p0 = me();
        if (he.stage === "result" || he.stage === "next" || over) return;
        if (!myTurnNow()) { he.picker = null; return; }
        const toCall = he.current - p0.bet;
        if (he.picker) { layoutPicker(); return; }
        const gap = 8, bw = (W - 16 - gap * 2) / 3, by = H - 64, bh = 54;
        const canRaise = he.raises < 4 && p0.chips > toCall;
        ui = [
          button("fold", "FOLD", 8, by, bw, bh, () => act(0, "fold"), { color: "#ff3c50", size: 11 }),
          button("call", toCall > 0 ? (toCall >= p0.chips ? "CALL ALL IN" : "CALL " + toCall) : "CHECK", 8 + bw + gap, by, bw, bh, () => act(0, "call"), { color: "#4dff7a", size: toCall > 999 || toCall >= p0.chips ? 8 : 10 }),
          button("raise", he.current ? "RAISE" : "BET", 8 + (bw + gap) * 2, by, bw, bh, () => openPicker(), { color: "#ffd63c", size: 11, enabled: canRaise }),
        ];
        focus = 1;
      }
      function openPicker() {
        const p0 = me();
        const min = minRaiseTo(p0), max = p0.bet + p0.chips;
        he.picker = { min, max, amount: min };
        Sound.play("select");
        layoutHE();
        focus = ui.findIndex(b => b.id === "confirm");
      }
      const pickerBox = () => ({ x: 8, y: H - 240, w: W - 16, h: 232 });
      function setAmount(v) {
        const pk = he.picker;
        if (!pk) return;
        const step = he.sb;
        let a = Math.round(v / step) * step;
        if (v >= pk.max) a = pk.max;
        pk.amount = Kit.clamp(a, pk.min, pk.max);
        const cf = ui.find(b => b.id === "confirm");
        if (cf) cf.label = (pk.amount === pk.max ? "ALL IN " : (he.current ? "RAISE TO " : "BET ")) + pk.amount;
      }
      function layoutPicker() {
        const b = pickerBox(), pk = he.picker, pot = potTotal();
        const half = (W - 16 - 8 * 3) / 4;
        const row1 = b.y + 136, row2 = b.y + 180;
        ui = [
          button("minus", "-", b.x + 12, b.y + 46, 52, 40, () => { setAmount(pk.amount - he.bb); Sound.play("move"); }, { color: "#3cf0ff", size: 18 }),
          button("plus", "+", b.x + b.w - 64, b.y + 46, 52, 40, () => { setAmount(pk.amount + he.bb); Sound.play("move"); }, { color: "#3cf0ff", size: 18 }),
          { id: "slider", kind: "slider", x: b.x + 20, y: b.y + 96, w: b.w - 40, h: 22 },
          button("q-min", "MIN", 8, row1, half, 34, () => setAmount(pk.min), { color: "#c04cff", size: 8 }),
          button("q-half", "1/2 POT", 8 + (half + 8), row1, half, 34, () => setAmount(he.current + pot / 2), { color: "#c04cff", size: 8 }),
          button("q-pot", "POT", 8 + (half + 8) * 2, row1, half, 34, () => setAmount(he.current + pot), { color: "#c04cff", size: 8 }),
          button("q-all", "ALL IN", 8 + (half + 8) * 3, row1, half, 34, () => setAmount(pk.max), { color: "#ff3cc8", size: 8 }),
          button("cancel", "CANCEL", 8, row2, (W - 24) * 0.38, 48, () => { he.picker = null; Sound.play("back"); layoutHE(); }, { color: "#888", size: 9 }),
          button("confirm", "", 16 + (W - 24) * 0.38, row2, (W - 24) * 0.62, 48, () => act(0, "raise", pk.amount), { color: "#ffd63c", size: 9 }),
        ];
        setAmount(pk.amount);
      }
      function drawPicker(g) {
        const b = pickerBox(), pk = he.picker;
        g.fillStyle = "rgba(6,2,14,.96)"; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = "#ffd63c"; g.lineWidth = 2; g.strokeRect(b.x, b.y, b.w, b.h);
        // your two cards, small, so you can still see your hand while you choose
        const p0 = me();
        if (p0.hole.length) { card(g, p0.hole[0], b.x + 8, b.y + 6, 26, 36); card(g, p0.hole[1], b.x + 36, b.y + 6, 26, 36); }
        Kit.text(g, "CHIPS " + p0.chips, b.x + b.w - 8, b.y + 14, 7, "#aaa", "right");
        Kit.text(g, he.current ? "RAISE TO" : "BET", W / 2, b.y + 18, 8, "#aaa");
        Kit.text(g, String(pk.amount), W / 2, b.y + 66, 20, pk.amount === pk.max ? "#ff3cc8" : "#fff", "center", "#ffd63c");
        const s = ui.find(u => u.id === "slider");
        if (s) {
          const frac = pk.max > pk.min ? (pk.amount - pk.min) / (pk.max - pk.min) : 1;
          g.fillStyle = "#222"; g.fillRect(s.x, s.y + 7, s.w, 8);
          g.fillStyle = "#ffd63c"; g.fillRect(s.x, s.y + 7, s.w * frac, 8);
          const kx = s.x + s.w * frac;
          g.fillStyle = "#fff"; g.fillRect(kx - 9, s.y, 18, 22);
          g.fillStyle = "#ffd63c"; g.fillRect(kx - 5, s.y + 4, 10, 14);
          Kit.text(g, String(pk.min), s.x, s.y + 32, 7, "#888", "left");
          Kit.text(g, String(pk.max), s.x + s.w, s.y + 32, 7, "#888", "right");
        }
      }

      // ---------------- drawing the table ----------------
      function seatBox(g, p, i) {
        const { x, y } = seatPos(i);
        const turn = he.toAct === i && !["result", "next"].includes(he.stage) && !p.folded && !p.out && !he.runout;
        const won = he.winners.has(p) && he.stage === "result";
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        if (turn || won) { g.globalAlpha = 0.25 + 0.25 * pulse; g.fillStyle = won ? "#ffd63c" : p.color; g.fillRect(x - 62, y - 50, 124, 110); g.globalAlpha = 1; }
        g.fillStyle = p.out ? "#1a1a1a" : turn ? "#22224a" : "#140a24";
        g.fillRect(x - 56, y - 44, 112, 98);
        g.strokeStyle = p.out ? "#333" : won ? "#ffd63c" : p.color; g.lineWidth = turn || won ? 3 : 2; g.strokeRect(x - 56, y - 44, 112, 98);
        Kit.text(g, p.name, x, y - 32, 8, p.out ? "#555" : p.color);
        Kit.text(g, p.out ? "OUT" : String(p.chips), x, y - 18, 8, "#fff");
        if (!p.out) {
          const show = he.showdown && !p.folded;
          drawCard(g, p.hole[0], x - 32, y - 8, 30, 42, { back: !show, dim: p.folded });
          drawCard(g, p.hole[1], x + 2, y - 8, 30, 42, { back: !show, dim: p.folded });
          if (he.dealer === i) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 48, y - 36, 7, 0, Math.PI * 2); g.fill(); Kit.text(g, "D", x + 48, y - 35, 7, "#000"); }
          if (show && he.stage === "result") Kit.text(g, CAT_NAMES[he.showdown.get(p).cat], x, y + 42, 6, won ? "#ffd63c" : "#aaa");
        }
        // thinking bar while it's their turn
        if (turn && p.cpu && he.wait > 0) { g.fillStyle = p.color; g.fillRect(x - 50, y + 50, 100 * (1 - he.wait / he.waitMax), 3); }
        if (p.said && !(he.stage === "result" && he.showdown && !p.folded)) Kit.text(g, p.said, x, y + 42, 7, p.said === "FOLD" ? "#888" : "#ffd63c");
        if (won) Kit.text(g, "WINNER", x, y - 52, 8, "#000", "center", "#ffd63c");
      }

      function drawHE(g) {
        // the felt
        const cy = H * 0.5;
        g.fillStyle = "#0a3a1e";
        g.beginPath(); g.ellipse(W / 2, cy, W * 0.48, H * 0.27, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#7a4a20"; g.lineWidth = 8; g.stroke();
        g.strokeStyle = "#ffd63c"; g.lineWidth = 1; g.globalAlpha = 0.4;
        g.beginPath(); g.ellipse(W / 2, cy, W * 0.44, H * 0.24, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
        // the deck, where cards come from
        const d = deckAt();
        for (let k = 0; k < 3; k++) card(g, null, d.x - k * 2, d.y - k * 2, 30, 42, { back: true });
        // shared cards and the pot
        const bg = boardGeom();
        for (let i = 0; i < 5; i++) {
          const x = bg.x + i * (bg.cw + 6);
          g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 2; g.strokeRect(x, bg.y, bg.cw, bg.ch);
          if (he.board[i]) drawCard(g, he.board[i], x, bg.y, bg.cw, bg.ch);
        }
        const pot = potTotal() - he.players.reduce((a, p) => a + p.bet, 0);
        const ps = potSpot();
        if (pot > 0 && he.stage !== "result") { chipStack(g, ps.x - 34, ps.y + 4, pot); }
        Kit.text(g, "POT " + potTotal(), W / 2, ps.y, 10, "#ffd63c", "center", "#000");
        Kit.text(g, "BLINDS " + he.sb + "/" + he.bb + " · UP IN " + (5 - ((he.hands - 1 + 5) % 5)), W / 2, bg.y + bg.ch + 16, 7, "#9c9");
        // bets in front of each player
        he.players.forEach((p, i) => { if (p.bet) { const b = betSpot(i); chipStack(g, b.x - 22, b.y + 4, p.bet); Kit.text(g, String(p.bet), b.x + 4, b.y, 8, "#ffd63c", "left", "#000"); } });
        he.players.forEach((p, i) => { if (i) seatBox(g, p, i); });
        // you
        const p0 = me(), my = seatPos(0);
        const mcw = Math.min(64, W * 0.17), mch = mcw * 1.42;
        const myTurn = myTurnNow();
        if (myTurn && !he.picker) { g.globalAlpha = 0.18 + 0.12 * Math.sin(t * 6); g.fillStyle = "#ff3cc8"; g.fillRect(W / 2 - mcw - 14, my.y - 20, mcw * 2 + 28, mch + 20); g.globalAlpha = 1; }
        if (p0.hole.length) {
          const won = he.winners.has(p0) && he.stage === "result";
          drawCard(g, p0.hole[0], W / 2 - mcw - 4, my.y - 10, mcw, mch, { dim: p0.folded, glow: won });
          drawCard(g, p0.hole[1], W / 2 + 4, my.y - 10, mcw, mch, { dim: p0.folded, glow: won });
        }
        if (he.dealer === 0) { g.fillStyle = "#fff"; g.beginPath(); g.arc(W / 2 + mcw + 22, my.y, 8, 0, Math.PI * 2); g.fill(); Kit.text(g, "D", W / 2 + mcw + 22, my.y + 1, 7, "#000"); }
        if (p0.said && he.stage !== "result") Kit.text(g, p0.said, W / 2, my.y + mch + 2, 7, "#ffd63c");
        else if (p0.hole.length && he.board.length >= 3 && !p0.folded) Kit.text(g, CAT_NAMES[best(p0.hole.concat(he.board)).cat], W / 2, my.y + mch + 2, 8, "#4dff7a");
        if (!he.picker) {
          if (he.stage === "result") Kit.text(g, he.msg, W / 2, H - 40, 8, "#fff", "center", "#000");
          else if (myTurn) { const toCall = he.current - p0.bet; Kit.text(g, toCall > 0 ? "YOUR TURN: " + toCall + " TO CALL" : "YOUR TURN", W / 2, my.y - 30, 8, "#ff3cc8", "center", "#000"); }
          else Kit.text(g, p0.folded ? "YOU FOLDED" : p0.allIn ? "YOU'RE ALL IN" : he.stage === "next" ? "" : "...", W / 2, H - 40, 8, "#888");
        }
        Kit.text(g, "HAND " + he.hands + " · TABLES WON " + he.tables, 10, 18, 7, "#888", "left");
        drawFlights(g);
        drawMeter(g, "YOUR CHIPS");
        if (he.picker) drawPicker(g);
      }

      // ---------------- the loop ----------------
      let repeatT = 0;
      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt); updateMeter(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (host.arcade && host.pad.dir) { repeatT -= dt; if (repeatT <= 0) { moveFocus(host.pad.dir); repeatT = 0.2; } }
        if (he.wait > 0) { he.wait -= dt; if (he.wait > 0) return; layoutHE(); } // the deal has finished: show your buttons if it's your turn
        if (he.stage === "next" || he.stage === "result") { newHand(); return; }
        if (he.runout) {
          if (he.stage === "river") finishHand();
          else {
            gatherBets();
            if (he.stage === "preflop") { dealBoard(3); he.stage = "flop"; }
            else if (he.stage === "flop") { dealBoard(1); he.stage = "turn"; }
            else if (he.stage === "turn") { dealBoard(1); he.stage = "river"; }
            Sound.noise(0.1, { vol: 0.1, freq: 5000, filter: "highpass" });
            setWait(1.1);
          }
          return;
        }
        const p = he.players[he.toAct];
        if (p.cpu && !p.folded && !p.allIn && !p.out) { const [what, amt] = cpuMove(he.toAct); act(he.toAct, what, amt); }
      }

      function draw(g) {
        g.fillStyle = "#06020e"; g.fillRect(0, 0, W, H);
        drawHE(g);
        drawUI(g);
        fx.draw(g);
        banner.draw(g, W, H);
      }

      // touch: tap a button; drag the raise slider
      function sliderTo(x) {
        const s = ui.find(u => u.id === "slider"), pk = he.picker;
        if (!s || !pk) return;
        setAmount(pk.min + Kit.clamp((x - s.x) / s.w, 0, 1) * (pk.max - pk.min));
      }
      function down(x, y) {
        if (over) return;
        for (const b of ui) {
          if (x < b.x - 6 || x > b.x + b.w + 6 || y < b.y - 10 || y > b.y + b.h + 10) continue;
          if (b.kind === "slider") { dragging = true; sliderTo(x); return; }
          if (b.enabled !== false) { b.onTap(); return; }
        }
      }
      function move(x) { if (dragging) sliderTo(x); }
      function up() { dragging = false; }

      // Arcade mode: the joystick moves a cursor between buttons (left/right on the slider changes the amount)
      function moveFocus(dir) {
        if (!ui.length) return;
        const cur = ui[Math.min(focus, ui.length - 1)];
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
        let bestI = -1, bestD = 1e9;
        ui.forEach((b, i) => {
          if (i === focus || b.kind === "slider") return;
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
        if (ev.type === "down" && ev.id === "a") { const b = ui[focus]; if (b && b.enabled !== false && b.onTap) b.onTap(); }
        if (ev.type === "down" && ev.id === "b") { const b = ui.find(x => x.id === "call" || x.id === "confirm"); if (b && b.enabled !== false) b.onTap(); }
      }

      layoutHE();
      const state = () => ({
        over, focus, picker: he.picker && { ...he.picker },
        ui: ui.map(b => ({ id: b.id, label: b.label, x: b.x, y: b.y, w: b.w, h: b.h, enabled: b.enabled !== false })),
        meter: { shown: Math.round(meter.shown), target: meter.target, flashing: meter.flash > 0 }, flights: flights.length,
        animating: [...dealt.values()].filter(t0 => t < t0 + 0.5).length,
        he: { stage: he.stage, toAct: he.toAct, sb: he.sb, bb: he.bb, hands: he.hands, tables: he.tables, board: he.board.map(c => ({ ...c })), current: he.current,
          players: he.players.map(p => ({ name: p.name, chips: p.chips, folded: p.folded, out: p.out, allIn: p.allIn, bet: p.bet, said: p.said, hole: p.cpu ? null : p.hole.map(c => ({ ...c })) })), pot: potTotal(), msg: he.msg },
      });
      return { update, draw, down, move, up, arcade, state, resize(w, h) { W = w; H = h; layoutHE(); }, _test: { eval5, best, winChance } };
    },
  });
})();
