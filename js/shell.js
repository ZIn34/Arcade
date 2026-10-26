// Runs one game: the score bar, the canvas, "how to play", pause, game over and high-score initials.
//
// A game file calls Arcade.addGame(id, { howTo: [...lines], music, create(host) }).
// create(host) returns an object with update(dt), draw(g) and optionally
// down(x, y, id), move(x, y, id), up(x, y, id), resize(w, h).
// host gives: W, H (play area size), addScore(n), setScore(n), score, gameOver(), sfx(name), Sound,
// arcade (true in Arcade mode) and pad (the arcade deck's live state). In Arcade mode a game can also
// give deck: { stick, buttons }, arcadeHowTo: [...lines] and an arcade(ev) handler (see deck.js).
const Arcade = {
  games: {},
  addGame(id, game) { this.games[id] = game; },
};

const Shell = (() => {
  const $ = id => document.getElementById(id);
  const stage = $("stage"), canvas = $("game-canvas"), overlay = $("overlay");
  const g = canvas.getContext("2d");
  let cab = null, game = null, inst = null, host = null;
  let running = false, paused = false, raf = 0, last = 0, onExit = null;
  let W = 0, H = 0, dpr = 1;

  const seenKey = id => "crexz-arcade.seen." + id + (arcade && game && game.arcadeHowTo ? ".arcade" : "");
  let arcade = false;

  function fit() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    if (host) { host.W = W; host.H = H; }
    if (inst && inst.resize) inst.resize(W, H);
  }

  function setScoreText(n) { $("hud-score").textContent = Math.floor(n); }

  function open(cabinet, exitCallback) {
    cab = cabinet;
    game = Arcade.games[cab.id];
    onExit = exitCallback;
    $("play").classList.remove("hidden");
    // Arcade mode: show the control deck set up for this game
    arcade = Deck.setup(game.deck, ev => { if (running && !paused && inst && inst.arcade) inst.arcade(ev); });
    $("play").classList.toggle("arcade", arcade);
    $("hud-hi").textContent = Scores.best(cab.id);
    setScoreText(0);
    fit();
    if (!localStorage.getItem(seenKey(cab.id)) && game.howTo) showHowTo(true);
    else start();
  }

  function showHowTo(first) {
    overlay.innerHTML = "";
    overlay.classList.remove("hidden");
    overlay.append(
      el("h2", { class: "neon-cyan", text: cab.name.replace("\n", " ") }),
      el("p", { class: "neon-yellow", text: "HOW TO PLAY" }),
      el("ul", {}, (arcade && game.arcadeHowTo ? game.arcadeHowTo : game.howTo).map(line => el("li", { text: line }))),
      button(first ? "GOT IT!" : "BACK", "", () => {
        localStorage.setItem(seenKey(cab.id), "1");
        Sound.play("select");
        if (first) start(); else resume();
      })
    );
  }

  function start() {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    Deck.release();
    host = {
      W, H, score: 0, Sound, arcade, pad: Deck.pad,
      addScore(n) { host.setScore(host.score + n); },
      setScore(n) {
        host.score = Math.max(0, Math.floor(n));
        setScoreText(host.score);
        if (host.score > Scores.best(cab.id)) $("hud-hi").textContent = host.score;
      },
      sfx(name) { Sound.play(name); },
      gameOver,
      get over() { return !running; },
    };
    setScoreText(0);
    $("hud-hi").textContent = Scores.best(cab.id);
    if (inst && inst.destroy) inst.destroy(); // tidy up the last round (e.g. tilt listeners)
    inst = game.create(host);
    if (inst.resize) inst.resize(W, H);
    running = true; paused = false;
    Sound.play("start");
    if (game.music) Sound.playMusic(game.music); else Sound.stopMusic();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    // The frame's timestamp can be a touch earlier than when the game started, so never step backwards.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    inst.update(dt);
    if (running) inst.draw(g, W, H);
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    Deck.release();
    Sound.stopMusic();
    overlay.innerHTML = "";
    overlay.classList.remove("hidden");
    overlay.append(
      el("h2", { class: "neon-yellow", text: "PAUSED" }),
      button("RESUME", "", () => { Sound.play("select"); resume(); }),
      ...(arcade && game.deck && game.deck.stick !== false ? [Deck.sensControl()] : []),
      button("HOW TO PLAY", "alt", () => { Sound.play("select"); showHowTo(false); }),
      button("BACK TO ARCADE", "alt", exit)
    );
  }
  function resume() {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    paused = false;
    if (game.music) Sound.playMusic(game.music, host && host.tempo || 1);
  }

  function gameOver() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    Deck.release();
    inst.draw(g, W, H);
    Sound.stopMusic();
    Sound.play("gameover");
    const score = host.score;
    // coins back for the score
    won = Coins.earned(cab.id, score);
    Coins.win(won);
    overlay.innerHTML = "";
    overlay.classList.remove("hidden");
    overlay.append(el("h2", { class: "neon-pink", text: "GAME OVER" }), el("p", { text: "SCORE " + score }), coinsWon());
    if (Scores.qualifies(cab.id, score)) setTimeout(() => askInitials(score), 700);
    else if (Coins.dayQualifies()) setTimeout(() => askDayInitials(-1), 700);
    else showResults(-1);
  }

  // The arcade-style 3-letter picker: arrows up and down on each letter, then SAVE.
  function initialsPicker(title, sub, onSave) {
    const letters = Scores.lastInitials().split("");
    let active = 0;
    const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
    overlay.innerHTML = "";
    const slots = el("div", { class: "initials" });
    const render = () => {
      slots.innerHTML = "";
      letters.forEach((ch, i) => {
        const step = d => () => {
          active = i;
          const k = (ABC.indexOf(letters[i]) + d + ABC.length) % ABC.length;
          letters[i] = ABC[k];
          Sound.play("move");
          render();
        };
        const letter = el("div", { class: "letter", text: ch === " " ? "_" : ch });
        letter.addEventListener("click", () => { active = i; render(); });
        slots.append(el("div", { class: "slot" + (i === active ? " active" : "") }, [
          button("▲", "", step(-1), true), letter, button("▼", "", step(1), true),
        ]));
      });
    };
    render();
    overlay.append(
      el("h2", { class: "neon-yellow", text: title }),
      el("p", { text: sub }),
      slots,
      button("SAVE", "", () => {
        const name = letters.join("");
        Scores.setLastInitials(name);
        Sound.play("credit");
        onSave(name.replace(/ /g, "_"));
      })
    );
  }

  function askInitials(score) {
    Sound.play("highscore");
    initialsPicker("NEW HIGH SCORE!", "SCORE " + score + "\nENTER YOUR INITIALS", name => {
      const place = Scores.add(cab.id, name, score);
      if (Coins.dayQualifies()) askDayInitials(place); else showResults(place);
    });
  }

  // Today's coins have made the "most coins in a day" board.
  function askDayInitials(place) {
    Sound.play("bonus");
    initialsPicker("BEST DAY!", "TODAY YOU'VE WON " + Coins.earnedToday() + " COINS\nTHAT'S A TOP " + Coins.BOARD_SIZE + " DAY!\nENTER YOUR INITIALS", name => {
      Coins.addDay(name);
      showResults(place);
    });
  }

  function showResults(myPlace) {
    overlay.innerHTML = "";
    const list = Scores.list(cab.id);
    const ol = el("ul", { class: "scores go-scores" });
    for (let i = 0; i < Scores.KEEP; i++) {
      const e = list[i];
      const li = el("li", { class: (e ? "" : "empty") + (i === myPlace ? " mine" : "") }, [
        el("span", { class: "rank", text: (i + 1) + "." }),
        el("span", { class: "name", text: e ? e.n : "---" }),
        el("span", { text: e ? String(e.s) : "0" }),
      ]);
      ol.append(li);
    }
    const have = Coins.count();
    const again = button(have > 0 ? "PLAY AGAIN · 1 COIN" : "OUT OF COINS", "", () => {
      if (!Coins.spend()) return;
      Sound.play("coin");
      start();
    });
    again.disabled = have <= 0;
    overlay.append(
      el("h2", { class: "neon-pink", text: "GAME OVER" }),
      el("p", { text: "SCORE " + (host ? host.score : 0) }),
      coinsWon(),
      el("div", { class: "scores-title", text: "HIGH SCORES" }),
      ol,
      again,
      el("p", { class: "coins-left", text: have > 0 ? "YOU HAVE " + have + (have === 1 ? " COIN" : " COINS") : "4 FREE COINS IN " + Coins.countdown() }),
      button("BACK TO ARCADE", "alt", exit)
    );
    $("hud-hi").textContent = Scores.best(cab.id);
  }

  // "+3 COINS" with a coin picture, and how many points a coin takes in this game
  let won = 0;
  function coinsWon() {
    const box = el("div", { class: "coins-won" }, [el("i", { class: "coin-ico" }), el("span", { text: "+" + won + (won === 1 ? " COIN" : " COINS") })]);
    const wrap = el("div", {}, [box,
      el("p", { class: "small-note", text: "1 COIN PER " + Coins.every(cab.id).toLocaleString("en-US") + " POINTS" }),
      el("p", { class: "small-note today-note", text: "TODAY: " + Coins.earnedToday() + " COINS WON" })]);
    wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center"; wrap.style.gap = "4px";
    return wrap;
  }

  function exit() {
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    Sound.stopMusic();
    Sound.play("back");
    if (inst && inst.destroy) inst.destroy();
    inst = null; host = null;
    Deck.hide();
    $("play").classList.remove("arcade");
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    $("play").classList.add("hidden");
    if (onExit) onExit(cab);
  }

  // ---- touch input, in play-area coordinates ----
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (running && !paused && inst && inst.down) inst.down(...pos(e), e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    e.preventDefault();
    if (running && !paused && inst && inst.move) inst.move(...pos(e), e.pointerId);
  });
  const up = e => { if (running && !paused && inst && inst.up) inst.up(...pos(e), e.pointerId); };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  // Stop iPhone from scrolling or zooming the page while playing.
  stage.addEventListener("touchmove", e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  $("btn-exit").addEventListener("click", () => { if (running && !paused) { Sound.play("select"); pause(); } else if (!running) exit(); });
  window.addEventListener("resize", () => { if (!$("play").classList.contains("hidden")) fit(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  // ---- tiny DOM helpers ----
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    if (attrs.class) n.className = attrs.class;
    if (attrs.text != null) n.textContent = attrs.text;
    if (attrs.text && attrs.text.includes("\n")) n.style.whiteSpace = "pre-line";
    children.forEach(c => n.append(c));
    return n;
  }
  function button(label, cls, fn, plain) {
    const b = el("button", { class: plain ? "" : "pix-btn " + cls, text: label });
    b.addEventListener("click", fn);
    return b;
  }

  return { open, el, button };
})();
