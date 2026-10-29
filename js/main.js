// Starts the arcade: tap to start, the CREXZ Studios logo intro, then the hall.
(() => {
  const $ = id => document.getElementById(id);

  // The intro, the same in every CREXZ game: black, the logo fades in, holds as long as the sound lasts,
  // fades out. Without a sound the logo holds for 1.5 seconds. Any tap skips it.
  const LEAD_IN = 0.3, FADE_IN = 1.0, FADE_OUT = 1.0, SILENT_HOLD = 1.5;
  const SOUND_VOL = 0.63; // -4 dB: the shared sound peaks just under full scale
  const introData = fetch("assets/intro-sound.wav").then(r => r.arrayBuffer()).catch(() => null);

  async function runIntro() {
    const intro = $("intro"), logo = $("intro-logo");
    intro.classList.remove("hidden");
    let buf = null;
    const data = await introData;
    if (data && Sound.ctx) {
      try { buf = await new Promise((res, rej) => Sound.ctx.decodeAudioData(data.slice(0), res, rej)); } catch (e) { buf = null; }
    }
    const hold = buf ? Math.max(buf.duration - FADE_IN - FADE_OUT, 0.5) : SILENT_HOLD;
    const total = FADE_IN + hold + FADE_OUT;
    const t0 = performance.now();
    let started = false, done = false;

    return new Promise(resolve => {
      const finish = () => {
        if (done) return;
        done = true;
        Sound.stopBuffer();
        intro.removeEventListener("pointerdown", finish);
        intro.classList.add("hidden");
        resolve();
      };
      intro.addEventListener("pointerdown", finish);
      const step = () => {
        if (done) return;
        const t = (performance.now() - t0) / 1000 - LEAD_IN;
        if (t >= 0 && !started) { started = true; if (buf) Sound.playBuffer(buf, SOUND_VOL); }
        let a = 0;
        if (t < 0) a = 0;
        else if (t < FADE_IN) a = t / FADE_IN;
        else if (t < FADE_IN + hold) a = 1;
        else if (t < total) a = 1 - (t - FADE_IN - hold) / FADE_OUT;
        else { logo.style.opacity = 0; finish(); return; }
        logo.style.opacity = a;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Mute buttons (one in the hall, one in each game) stay in step and are remembered.
  const muteBtns = [$("btn-mute"), $("btn-mute2")];
  const showMute = m => muteBtns.forEach(b => { b.classList.toggle("muted", m); b.setAttribute("aria-pressed", m); });
  showMute(Sound.isMuted());
  Sound.onMuteChange(showMute);
  muteBtns.forEach(b => b.addEventListener("click", e => { e.stopPropagation(); Sound.unlock(); Sound.toggleMute(); Sound.play("select"); }));

  $("btn-info").addEventListener("click", () => { Sound.play("select"); $("about").classList.remove("hidden"); });
  $("btn-about-close").addEventListener("click", () => { Sound.play("back"); $("about").classList.add("hidden"); });

  // Any tap anywhere keeps the audio awake (iPhone can suspend it).
  document.addEventListener("pointerdown", () => Sound.unlock(), true);

  // On CrazyGames their SDK starts first (it loads the player's saved coins and scores).
  (async () => {
    await Platform.init();
    if (Platform.crazy) Sound.setMuted(Save.getItem("crexz-arcade.muted") === "1");

    // a game left mid-way when the app last closed still counts
    const settled = Shell.settleUnfinished();
    Hall.build();
    Shop.init();

    const power = $("power");
    power.addEventListener("pointerdown", async () => {
      Sound.unlock();
      power.classList.add("hidden");
      await runIntro();
      Hall.show();
      if (settled) {
        const name = CABINETS.find(c => c.id === settled.id)?.name.replace(/\s+/g, " ") || "";
        Shop.toast(`LAST GAME COUNTED<br><span>${name}: ${settled.score} POINTS` +
          (settled.place >= 0 ? ` · #${settled.place + 1} HIGH SCORE` : "") + (settled.coins > 0 ? ` · +${settled.coins} COINS` : "") + "</span>", 6000);
      }
    }, { once: true });

    // Works offline once loaded (not on CrazyGames, which hosts the game itself).
    if (!Platform.crazy && "serviceWorker" in navigator && location.protocol !== "file:") {
      const hadController = !!navigator.serviceWorker.controller;
      const register = () => navigator.serviceWorker.register("sw.js").then(reg => {
        // look for a newer arcade whenever the app comes back to the front
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
      if (document.readyState === "complete") register(); else window.addEventListener("load", register);
      // A newer arcade has been saved on the phone: switch to it, but never in the middle of a game.
      let pending = false;
      const inGame = () => ["play", "coin", "shop"].some(id => !$(id).classList.contains("hidden"));
      const reloadSoon = () => { if (!inGame()) location.reload(); else pending = true; };
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) reloadSoon(); });
      setInterval(() => { if (pending && !inGame()) location.reload(); }, 1000);
    }
  })();
})();
