// The coin wallet, kept on the phone. Every new day tops you back up to 4 free coins (anything you've
// won above 4 is kept). Starting a game costs 1 coin; a finished game pays coins back for its score.
const Coins = (() => {
  const KEY = "crexz-arcade.coins", DAY_KEY = "crexz-arcade.coinDay";
  const DAILY = 4;
  const listeners = [];

  // Points needed for 1 coin in each game (games without a number here use DEFAULT_EVERY).
  const EVERY = {
    starlance: 1000, pixelpile: 1000, gloworm: 100, brickquake: 250,
    vaultrunner: 500, duckdash: 200, cometcrush: 2000,
    skyhopper: 250, turbolane: 500, pulsetap: 1000,
  };
  const DEFAULT_EVERY = 500;

  const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };

  function read() { const n = parseInt(localStorage.getItem(KEY), 10); return Number.isFinite(n) && n >= 0 ? n : 0; }
  function write(n) { localStorage.setItem(KEY, String(Math.max(0, Math.floor(n)))); listeners.forEach(f => f(read())); }

  // Called on start-up and whenever the app comes back: a new day tops you up to 4.
  function refill() {
    if (localStorage.getItem(DAY_KEY) === today()) return false;
    localStorage.setItem(DAY_KEY, today());
    if (read() < DAILY) { write(DAILY); return true; }
    listeners.forEach(f => f(read()));
    return false;
  }

  function count() { refill(); return read(); }
  function spend() { refill(); const n = read(); if (n <= 0) return false; write(n - 1); return true; }
  function add(n) { if (n > 0) write(read() + n); }
  function earned(gameId, score) { return Math.floor(Math.max(0, score) / (EVERY[gameId] || DEFAULT_EVERY)); }
  function every(gameId) { return EVERY[gameId] || DEFAULT_EVERY; }

  // Time until local midnight, when the next free coins arrive.
  function msToRefill() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next - now;
  }
  function countdown() {
    const s = Math.ceil(msToRefill() / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
  }
  function onChange(f) { listeners.push(f); }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refill(); });

  return { DAILY, count, spend, add, earned, every, refill, countdown, msToRefill, onChange };
})();
