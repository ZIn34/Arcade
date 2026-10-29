// Where the arcade is running. The CrazyGames copy (made by tools/make_crazygames.py) loads their SDK;
// then saves go to the player's CrazyGames account (their "data" module, shared across devices), gameplay
// start/stop is reported, and the coin shop sells through their store. Everywhere else nothing changes.
const Platform = (() => {
  const sdk = () => window.CrazyGames && window.CrazyGames.SDK;
  let crazy = false, env = "web";

  // Saved data: the same calls as localStorage, sent to CrazyGames' save when on CrazyGames.
  const store = () => (crazy && sdk().data) || window.localStorage;
  const Save = {
    getItem: k => { try { return store().getItem(k); } catch (e) { return null; } },
    setItem: (k, v) => { try { store().setItem(k, String(v)); } catch (e) { /* save failed: keep playing */ } },
    removeItem: k => { try { store().removeItem(k); } catch (e) { /* ignore */ } },
  };

  async function init() {
    if (!sdk()) return;
    try {
      await sdk().init();
      env = sdk().environment; // "crazygames", "local" (testing on this computer) or "disabled"
      crazy = env === "crazygames" || env === "local";
    } catch (e) { crazy = false; }
  }

  // Tell CrazyGames when someone is actually playing (not in menus or paused).
  let playing = false;
  function gameplay(on) {
    if (!crazy || on === playing) return;
    playing = on;
    try { if (on) sdk().game.gameplayStart(); else sdk().game.gameplayStop(); } catch (e) { /* ignore */ }
  }

  return {
    init, Save, gameplay, sdk,
    get crazy() { return crazy; },
    get env() { return env; },
  };
})();
const Save = Platform.Save;
