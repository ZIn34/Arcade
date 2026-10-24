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
    scrollTimer = setTimeout(() => { aim = null; localStorage.setItem("crexz-arcade.cabinet", String(current)); }, 200);
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

  // The insert coin moment: the coin spins, drops into the slot, the credit counter ticks up, then the game starts.
  function insertCoin(cab) {
    Sound.play("select");
    Sound.stopMusic();
    const scr = $("coin");
    $("coin-title").textContent = cab.name.replace("\n", " ");
    $("coin-title").style.textShadow = `0 0 6px ${cab.c}, 0 0 16px ${cab.c}`;
    $("coin-msg").textContent = "INSERT COIN";
    $("coin-credit").textContent = "CREDIT 00";
    const sprite = $("coin-sprite");
    sprite.style.backgroundImage = `url(${Pixel.bake(Pixel.COIN, Pixel.COIN_PAL, 1).toDataURL()})`;
    sprite.classList.remove("drop");
    const slot = scr.querySelector(".coin-slot");
    slot.classList.remove("flash");
    scr.classList.remove("hidden");

    let done = false;
    const timers = [];
    const go = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      scr.removeEventListener("click", go);
      scr.classList.add("hidden");
      Shell.open(cab, backToHall);
    };
    timers.push(setTimeout(() => { void sprite.offsetWidth; sprite.classList.add("drop"); }, 250));
    timers.push(setTimeout(() => { Sound.play("coin"); slot.classList.add("flash"); }, 1050));
    timers.push(setTimeout(() => {
      Sound.play("credit");
      $("coin-credit").textContent = "CREDIT 01";
      $("coin-msg").textContent = "PLAYER 1 READY!";
    }, 1400));
    timers.push(setTimeout(go, 2300));
    // A tap hurries it along once the coin is in.
    setTimeout(() => scr.addEventListener("click", go), 1100);
  }

  function backToHall() {
    refreshScreens();
    Sound.playMusic("hall");
  }

  function show() {
    $("hall").classList.remove("hidden");
    shownAt = performance.now();
    const saved = parseInt(localStorage.getItem("crexz-arcade.cabinet") || "0", 10) || 0;
    requestAnimationFrame(() => {
      const c = cards[Math.min(saved, cards.length - 1)].card;
      row.scrollLeft = c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2;
      markCurrent(Math.min(saved, cards.length - 1));
    });
    Sound.playMusic("hall");
  }

  return { build, show, refreshScreens };
})();
