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

  // ---- best days: the most coins won from scores in a single day (free daily coins don't count) ----
  const EARN_KEY = "crexz-arcade.dayEarned", BOARD_KEY = "crexz-arcade.dayBoard", BOARD_SIZE = 5;
  const readJSON = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (e) { return fallback; } };
  function earnedToday() { const v = readJSON(EARN_KEY, {}); return v && v.d === today() ? v.n : 0; }
  function board() { const b = readJSON(BOARD_KEY, []); return Array.isArray(b) ? b.filter(e => e && typeof e.c === "number").slice(0, BOARD_SIZE) : []; }
  function saveBoard(b) { b.sort((x, y) => y.c - x.c); localStorage.setItem(BOARD_KEY, JSON.stringify(b.slice(0, BOARD_SIZE))); }
  // Coins won for a score: into the wallet, and onto today's tally (today's board entry keeps up by itself).
  function win(n) {
    if (!(n > 0)) return;
    add(n);
    const total = earnedToday() + n;
    localStorage.setItem(EARN_KEY, JSON.stringify({ d: today(), n: total }));
    const b = board(), mine = b.find(e => e.d === today());
    if (mine) { mine.c = total; saveBoard(b); }
  }
  // Would today's total get onto the board (and it isn't there yet)?
  function dayQualifies() {
    const total = earnedToday(), b = board();
    if (total <= 0 || b.some(e => e.d === today())) return false;
    return b.length < BOARD_SIZE || total > b[b.length - 1].c;
  }
  function addDay(name) {
    const b = board();
    b.push({ n: String(name).toUpperCase().slice(0, 3), c: earnedToday(), d: today() });
    saveBoard(b);
    return board().findIndex(e => e.d === today());
  }
  // "OCT 25" from a saved day
  function dayLabel(d) {
    const [y, m, dd] = String(d).split("-").map(Number);
    return ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][(m || 1) - 1] + " " + dd + (y !== new Date().getFullYear() ? " " + y : "");
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refill(); });

  return { DAILY, BOARD_SIZE, count, spend, add, win, earned, every, refill, countdown, msToRefill, onChange,
    earnedToday, board, dayQualifies, addDay, dayLabel, today };
})();
