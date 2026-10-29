// The arcade hall: the row of cabinets, the high-score tables on their screens, and the insert coin moment.
const Hall = (() => {
  const $ = id => document.getElementById(id);
  const row = $("cabinets"), dots = $("dots");
  let current = 0, shownAt = 0;
  const cards = [];

  function build() {
    row.innerHTML = "";
    dots.innerHTML = "";
    CABINETS.forEach((cab, i) => {
      const card = document.createElement("div");
      card.className = "cabinet";
      card.style.setProperty("--c", cab.c);
      card.style.setProperty("--c2", cab.c2);
      card.style.setProperty("--body", cab.body);
      card.style.setProperty("--marq", cab.marq);
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", cab.name.replace("\n", " "));

      const marquee = document.createElement("div");
      marquee.className = "marquee";
      const art = Pixel.bake(cab.art, cab.pal, 1);
      const title = document.createElement("div");
      title.className = "title";
      title.style.whiteSpace = "pre-line";
      title.textContent = cab.name;
      const art2 = Pixel.bake(cab.art, cab.pal, 1, true);
      marquee.append(art, title, art2);

      const screen = document.createElement("div");
      screen.className = "cab-screen";

      const deck = document.createElement("div");
      deck.className = "control-deck";
      deck.innerHTML = '<div class="stick"></div><div class="cab-slot"></div><div class="cab-buttons"><i></i><i></i></div>';

      card.append(marquee, screen, deck);
      card.addEventListener("click", () => {
        // The tap that skipped the intro must not also start a game.
        if (performance.now() - shownAt < 500) return;
        if (i !== current) { scrollTo(i); return; }
        choose(i);
      });
      row.append(card);
      cards.push({ card, screen, cab });

      const d = document.createElement("i");
      dots.append(d);
    });
    refreshScreens();
    markCurrent(0);
  }

  // Each cabinet's screen shows its tagline, its top 5 and a blinking insert coin.
  function refreshScreens() {
    cards.forEach(({ screen, cab }) => {
      const playable = !!Arcade.games[cab.id];
      screen.innerHTML = "";
      const tag = document.createElement("div");
      tag.className = "cab-tagline";
      tag.style.whiteSpace = "pre-line";
      tag.textContent = cab.tagline;
      const head = document.createElement("div");
      head.className = "scores-title";
      head.textContent = "HIGH SCORES";
      const ol = document.createElement("ul");
      ol.className = "scores";
      const list = Scores.list(cab.id);
      for (let i = 0; i < Scores.KEEP; i++) {
        const e = list[i];
        const li = document.createElement("li");
        if (!e) li.className = "empty";
        li.innerHTML = `<span class="rank">${i + 1}.</span><span class="name">${e ? e.n.replace(/[<>&]/g, "") : "---"}</span><span>${e ? e.s : 0}</span>`;
        ol.append(li);
      }
      const foot = document.createElement("div");
      if (playable) {
        foot.className = "cab-insert";
        foot.textContent = "TAP TO INSERT COIN";
      } else {
        foot.className = "cab-oos";
        foot.innerHTML = "<span>OUT OF ORDER<br><br>COMING SOON</span>";
      }
      screen.append(tag, head, ol, foot);
    });
  }

  function markCurrent(i) {
    current = i;
    cards.forEach((c, k) => c.card.classList.toggle("current", k === i));
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
  }

  function scrollTo(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    aim = i;
    const c = cards[i].card;
    row.scrollTo({ left: c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
  }

  // Work out which cabinet is in the middle as the row is swiped.
  let scrollTimer = 0;
  row.addEventListener("scroll", () => {
    const mid = row.scrollLeft + row.clientWidth / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, k) => {
      const d = Math.abs(c.card.offsetLeft + c.card.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best !== current) { markCurrent(best); Sound.play("move"); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { aim = null; Save.setItem("crexz-arcade.cabinet", String(current)); }, 200);
  }, { passive: true });

  // Quick repeated arrow taps step on from where the last tap was heading, not from where the row is mid-glide.
  let aim = null;
  $("btn-prev").addEventListener("click", () => scrollTo((aim != null ? aim : current) - 1));
  $("btn-next").addEventListener("click", () => scrollTo((aim != null ? aim : current) + 1));

  function choose(i) {
    const cab = CABINETS[i];
    if (!Arcade.games[cab.id]) {
      Sound.play("lose");
      const card = cards[i].card;
      card.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 240 });
      return;
    }
    insertCoin(cab);
  }

  // ---- insert coin: drag a coin from the purse in the corner into the slot ----
  const COIN_URL = Pixel.bake(Pixel.COIN, Pixel.COIN_PAL, 1).toDataURL();
  document.documentElement.style.setProperty("--coin-img", `url(${COIN_URL})`);
  ["coin-sprite", "purse-coin", "drag-coin", "coin-hint"].forEach(id => { $(id).style.backgroundImage = `url(${COIN_URL})`; });

  let coinCab = null, coinState = "idle", timerTick = 0, dragId = null;
  const scr = $("coin"), slot = $("coin-slot"), purse = $("purse-coin"), dragEl = $("drag-coin"), hint = $("coin-hint");

  function showCoins() {
    const n = Coins.count();
    $("hall-coins").textContent = "x " + n;
    $("hall-coins-note").textContent = n === 0 ? "MORE IN " + Coins.countdown() : "";
    $("purse-count").textContent = "x" + n;
    purse.classList.toggle("empty", n === 0);
  }
  Coins.onChange(showCoins);
  setInterval(() => {
    if (!$("hall").classList.contains("hidden") || !scr.classList.contains("hidden")) showCoins();
    if (coinState === "out") { $("coin-timer").textContent = Coins.countdown(); if (Coins.count() > 0) openCoinScreen(coinCab); }
  }, 1000);

  function openCoinScreen(cab) {
    coinCab = cab;
    $("coin-title").textContent = cab.name.replace("\n", " ");
    $("coin-title").style.textShadow = `0 0 6px ${cab.c}, 0 0 16px ${cab.c}`;
    $("coin-credit").textContent = "CREDIT 00";
    $("coin-sprite").classList.remove("drop");
    slot.classList.remove("flash", "over");
    dragEl.classList.add("hidden");
    scr.classList.remove("hidden");
    showCoins();
    const n = Coins.count();
    coinState = n > 0 ? "waiting" : "out";
    $("coin-out").classList.toggle("hidden", n > 0);
    $("coin-msg").classList.toggle("hidden", n === 0);
    $("coin-credit").classList.toggle("hidden", n === 0);
    $("coin-msg").textContent = "DRAG A COIN INTO THE SLOT";
    $("coin-timer").textContent = Coins.countdown();
    slot.classList.toggle("ready", n > 0);
    // the see-through coin shows the way from the purse to the slot
    requestAnimationFrame(() => {
      const p = purse.getBoundingClientRect(), s = slot.getBoundingClientRect();
      hint.style.setProperty("--hx0", p.left + p.width / 2 + "px");
      hint.style.setProperty("--hy0", p.top + p.height / 2 + "px");
      hint.style.setProperty("--hx1", s.left + s.width / 2 + "px");
      hint.style.setProperty("--hy1", s.top + s.height / 2 + "px");
      hint.classList.toggle("on", n > 0);
    });
  }

  function insertCoin(cab) {
    Sound.play("select");
    Sound.stopMusic();
    openCoinScreen(cab);
  }

  function overSlot(x, y) {
    const r = slot.getBoundingClientRect(), pad = 40;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }
  function placeDrag(x, y) { dragEl.style.left = x + "px"; dragEl.style.top = y + "px"; }

  purse.addEventListener("pointerdown", e => {
    if (coinState !== "waiting" || Coins.count() <= 0) { if (coinState === "out") Sound.play("lose"); return; }
    e.preventDefault();
    dragId = e.pointerId;
    try { purse.setPointerCapture(e.pointerId); } catch (_) {}
    coinState = "dragging";
    hint.classList.remove("on");
    dragEl.classList.remove("hidden", "back");
    placeDrag(e.clientX, e.clientY);
    Sound.play("move");
  });
  purse.addEventListener("pointermove", e => {
    if (coinState !== "dragging" || e.pointerId !== dragId) return;
    placeDrag(e.clientX, e.clientY);
    slot.classList.toggle("over", overSlot(e.clientX, e.clientY));
  });
  const release = e => {
    if (coinState !== "dragging" || e.pointerId !== dragId) return;
    dragId = null;
    slot.classList.remove("over");
    if (overSlot(e.clientX, e.clientY) && Coins.spend()) {
      coinIn();
    } else {
      // not over the slot: the coin slides back to the purse
      coinState = "waiting";
      const p = purse.getBoundingClientRect();
      dragEl.classList.add("back");
      placeDrag(p.left + p.width / 2, p.top + p.height / 2);
      setTimeout(() => { dragEl.classList.add("hidden"); dragEl.classList.remove("back"); hint.classList.add("on"); }, 260);
      Sound.play("back");
    }
  };
  purse.addEventListener("pointerup", release);
  purse.addEventListener("pointercancel", release);

  // The coin drops into the slot, the credit ticks up, then the game starts.
  function coinIn() {
    coinState = "in";
    dragEl.classList.add("hidden");
    const sprite = $("coin-sprite");
    void sprite.offsetWidth;
    sprite.classList.add("drop");
    slot.classList.remove("ready");
    slot.classList.add("flash");
    Sound.play("coin");
    showCoins();
    setTimeout(() => {
      Sound.play("credit");
      $("coin-credit").textContent = "CREDIT 01";
      $("coin-msg").textContent = "PLAYER 1 READY!";
    }, 350);
    setTimeout(() => {
      if (coinState !== "in") return;
      coinState = "idle";
      scr.classList.add("hidden");
      Shell.open(coinCab, backToHall);
    }, 1200);
  }

  $("btn-coin-back").addEventListener("click", () => {
    if (coinState === "in") return;
    coinState = "idle";
    hint.classList.remove("on");
    dragEl.classList.add("hidden");
    scr.classList.add("hidden");
    Sound.play("back");
    backToHall();
  });

  // ---- NORMAL / ARCADE switch ----
  function showMode() {
    const m = Deck.mode();
    $("mode-normal").classList.toggle("on", m === "normal");
    $("mode-arcade").classList.toggle("on", m === "arcade");
    $("hall-sens").classList.toggle("hidden", m !== "arcade"); // the stick setting only matters in Arcade mode
  }
  $("hall-sens").append(Deck.sensControl());
  $("mode-normal").addEventListener("click", e => { e.stopPropagation(); Deck.setMode("normal"); Sound.play("select"); showMode(); });
  $("mode-arcade").addEventListener("click", e => { e.stopPropagation(); Deck.setMode("arcade"); Sound.play("credit"); showMode(); });
  showMode();

  // ---- the "most coins in a day" board ----
  function showDays() {
    const ul = $("days-board");
    ul.innerHTML = "";
    const b = Coins.board(), today = Coins.today();
    for (let i = 0; i < Coins.BOARD_SIZE; i++) {
      const e = b[i];
      const li = document.createElement("li");
      li.className = (e ? "" : "empty") + (e && e.d === today ? " today" : "");
      const cells = [["rank", (i + 1) + "."], ["name", e ? e.n.replace(/[<>&]/g, "") : "---"], ["coins", e ? String(e.c) : "0"], ["day", e ? Coins.dayLabel(e.d) : ""]];
      for (const [cls, txt] of cells) {
        const sp = document.createElement("span"); sp.className = cls; sp.textContent = txt;
        if (cls === "coins" && e) { const ico = document.createElement("i"); ico.className = "coin-ico"; sp.append(ico); }
        li.append(sp);
      }
      ul.append(li);
    }
    const n = Coins.earnedToday(), last = b.length >= Coins.BOARD_SIZE ? b[b.length - 1].c : 0;
    const onIt = b.some(e => e.d === today);
    $("days-today").textContent = "TODAY: " + n + " COINS WON" + (onIt ? " ★ ON THE BOARD" : last && n <= last ? " · BEAT " + last + " TO GET ON" : "");
    $("days").classList.remove("hidden");
  }
  $("btn-days").addEventListener("click", e => { e.stopPropagation(); Sound.play("select"); showDays(); });
  $("btn-days-close").addEventListener("click", () => { Sound.play("back"); $("days").classList.add("hidden"); });

  function backToHall() {
    refreshScreens();
    showCoins();
    Sound.playMusic("hall");
  }

  function show() {
    $("hall").classList.remove("hidden");
    shownAt = performance.now();
    showCoins();
    const saved = parseInt(Save.getItem("crexz-arcade.cabinet") || "0", 10) || 0;
    requestAnimationFrame(() => {
      const c = cards[Math.min(saved, cards.length - 1)].card;
      row.scrollLeft = c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2;
      markCurrent(Math.min(saved, cards.length - 1));
    });
    Sound.playMusic("hall");
  }

  return { build, show, refreshScreens };
})();
