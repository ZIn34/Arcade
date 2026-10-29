// Arcade mode: the control deck under the game, with a joystick and big glowing buttons.
// A game says what it needs with `deck: { stick: true|false, buttons: [{ id, label, color }] }`
// and receives input through arcade(ev):
//   { type: "dir", dir: "up"|"down"|"left"|"right"|null }   joystick pushed one way (or let go)
//   { type: "stick", x, y }                                 joystick position, each -1..1 (y down is +)
//   { type: "down" | "up", id }                             a button pressed or released
// The live state is also on host.pad: { x, y, dir, held: { [id]: true } }.
const Deck = (() => {
  const MODE_KEY = "crexz-arcade.mode";
  const $ = id => document.getElementById(id);
  const deck = $("deck"), base = $("stick-base"), knob = $("stick-knob"), btnBox = $("deck-buttons");
  const pad = { x: 0, y: 0, dir: null, held: {} };
  let listener = null, stickId = null;
  const modeListeners = [];

  const mode = () => (Save.getItem(MODE_KEY) === "arcade" ? "arcade" : "normal");

  // Joystick sensitivity, 1 to 5 (3 to start with). Low: ignores small nudges and needs a big push for
  // full speed. High: reacts to a small push and reaches full speed sooner.
  const SENS_KEY = "crexz-arcade.stickSens";
  const DEAD = [0, 0.25, 0.18, 0.12, 0.07, 0.04], GAIN = [0, 1.0, 1.2, 1.45, 1.8, 2.3];
  const sens = () => { const n = parseInt(Save.getItem(SENS_KEY), 10); return n >= 1 && n <= 5 ? n : 3; };
  const sensListeners = [];
  function setSens(n) { Save.setItem(SENS_KEY, String(Math.max(1, Math.min(5, n)))); sensListeners.forEach(f => f(sens())); }
  function onSens(f) { sensListeners.push(f); }
  // how far the stick is pushed (0..1) turned into how much it counts (0..1) at this sensitivity
  function curve(raw) {
    const n = sens(), m = Math.abs(raw);
    if (m <= DEAD[n]) return 0;
    return Math.sign(raw) * Math.min(1, ((m - DEAD[n]) / (1 - DEAD[n])) * GAIN[n]);
  }
  function setMode(m) { Save.setItem(MODE_KEY, m === "arcade" ? "arcade" : "normal"); modeListeners.forEach(f => f(mode())); }
  function onMode(f) { modeListeners.push(f); }

  function emit(ev) { if (listener) listener(ev); }

  // Show the deck set up for one game (or hide it). Returns whether it's showing.
  function setup(gameDeck, onInput) {
    release();
    listener = onInput;
    if (mode() !== "arcade") { deck.classList.add("hidden"); return false; }
    const cfg = gameDeck || { stick: true, buttons: [] };
    deck.classList.remove("hidden");
    base.parentElement.classList.toggle("hidden", cfg.stick === false);
    btnBox.innerHTML = "";
    (cfg.buttons || []).forEach(b => {
      const wrap = document.createElement("div");
      wrap.className = "deck-btn-wrap";
      const btn = document.createElement("button");
      btn.className = "deck-btn";
      btn.style.setProperty("--bc", b.color || "#ff3c50");
      btn.setAttribute("aria-label", b.label);
      btn.dataset.id = b.id;
      const lab = document.createElement("div");
      lab.className = "deck-label";
      lab.textContent = b.label;
      wrap.append(btn, lab);
      btnBox.append(wrap);
      const press = e => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        if (pad.held[b.id]) return;
        pad.held[b.id] = true; btn.classList.add("on");
        emit({ type: "down", id: b.id });
      };
      const lift = e => {
        if (!pad.held[b.id]) return;
        pad.held[b.id] = false; btn.classList.remove("on");
        emit({ type: "up", id: b.id });
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", lift);
      btn.addEventListener("pointercancel", lift);
    });
    // spread the buttons out when there are three; centre whatever is there when one side is empty
    btnBox.classList.toggle("three", (cfg.buttons || []).length >= 3);
    deck.classList.toggle("nostick", cfg.stick === false);
    deck.classList.toggle("nobuttons", !(cfg.buttons || []).length);
    return true;
  }

  // ---- the joystick: drag the ball top; it springs back to the middle when you let go ----
  function stickAt(e) {
    const r = base.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy), max = R * 0.62;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    pad.x = curve(dx / max); pad.y = curve(dy / max);
    let dir = null;
    if (Math.hypot(pad.x, pad.y) > 0.45) dir = Math.abs(pad.x) > Math.abs(pad.y) ? (pad.x > 0 ? "right" : "left") : (pad.y > 0 ? "down" : "up");
    emit({ type: "stick", x: pad.x, y: pad.y });
    if (dir !== pad.dir) { pad.dir = dir; emit({ type: "dir", dir }); if (dir) Sound.tone(220, 0.02, { vol: 0.06 }); }
  }
  function stickRelease() {
    stickId = null;
    knob.style.transform = "translate(0px, 0px)";
    pad.x = 0; pad.y = 0;
    emit({ type: "stick", x: 0, y: 0 });
    if (pad.dir) { pad.dir = null; emit({ type: "dir", dir: null }); }
  }
  base.addEventListener("pointerdown", e => {
    e.preventDefault();
    stickId = e.pointerId;
    try { base.setPointerCapture(e.pointerId); } catch (_) {}
    stickAt(e);
  });
  base.addEventListener("pointermove", e => { if (e.pointerId === stickId) stickAt(e); });
  base.addEventListener("pointerup", e => { if (e.pointerId === stickId) stickRelease(); });
  base.addEventListener("pointercancel", e => { if (e.pointerId === stickId) stickRelease(); });
  deck.addEventListener("touchmove", e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  // Let go of everything (pausing, leaving a game, a new round).
  function release() {
    if (stickId != null || pad.dir || pad.x || pad.y) stickRelease();
    for (const id in pad.held) if (pad.held[id]) { pad.held[id] = false; emit({ type: "up", id }); }
    btnBox.querySelectorAll(".deck-btn.on").forEach(b => b.classList.remove("on"));
  }
  function hide() { release(); listener = null; deck.classList.add("hidden"); }

  // A "STICK 1 2 3 4 5" picker, used in the hall and in the pause menu.
  function sensControl() {
    const row = document.createElement("div");
    row.className = "sens-row";
    const lab = document.createElement("span");
    lab.className = "sens-label"; lab.textContent = "STICK";
    row.append(lab);
    const btns = [];
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement("button");
      b.className = "sens-opt"; b.textContent = String(n); b.dataset.s = String(n);
      b.setAttribute("aria-label", "Joystick sensitivity " + n);
      b.addEventListener("click", e => { e.stopPropagation(); setSens(n); Sound.play("move"); });
      btns.push(b); row.append(b);
    }
    const show = () => btns.forEach((b, i) => b.classList.toggle("on", i + 1 === sens()));
    show(); onSens(show);
    return row;
  }

  return { mode, setMode, onMode, sens, setSens, onSens, sensControl, setup, release, hide, pad };
})();
