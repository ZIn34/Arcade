// High scores, kept on the phone (or in the CrazyGames save there). Each game keeps its top 5 with 3-letter initials.
const Scores = (() => {
  const KEEP = 5;
  const key = id => "crexz-arcade.scores." + id;

  function list(id) {
    try {
      const v = JSON.parse(Save.getItem(key(id)) || "[]");
      return Array.isArray(v) ? v.filter(e => e && typeof e.s === "number").slice(0, KEEP) : [];
    } catch (e) { return []; }
  }
  function best(id) { const l = list(id); return l.length ? l[0].s : 0; }
  function qualifies(id, score) {
    if (!(score > 0)) return false;
    const l = list(id);
    return l.length < KEEP || score > l[l.length - 1].s;
  }
  // Returns the place (0-based) the new score went in, or -1.
  function add(id, name, score) {
    const l = list(id);
    const entry = { n: String(name).toUpperCase().slice(0, 3), s: Math.floor(score) };
    let i = l.findIndex(e => score > e.s);
    if (i < 0) i = l.length;
    if (i >= KEEP) return -1;
    l.splice(i, 0, entry);
    Save.setItem(key(id), JSON.stringify(l.slice(0, KEEP)));
    return i;
  }

  const LAST_KEY = "crexz-arcade.lastInitials";
  function lastInitials() { return (Save.getItem(LAST_KEY) || "AAA").slice(0, 3); }
  function setLastInitials(n) { Save.setItem(LAST_KEY, n); }

  return { KEEP, list, best, qualifies, add, lastInitials, setLastInitials };
})();
