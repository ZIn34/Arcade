// The coin shop: buy coin packs with real money. Payment happens on Stripe's own secure checkout page;
// the arcade never sees card details. Our small server (a Supabase function) makes the checkout page and
// later checks with Stripe that the payment really went through before the coins are handed out (once).
// iPhone catch: the home-screen app and Safari keep separate storage, so the app remembers which
// checkouts it started and collects them whenever it comes back to the front.
const Shop = (() => {
  const API = "https://ihekeocsoqwvmbnksmxd.supabase.co/functions/v1/coins";
  const PENDING_KEY = "crexz-arcade.pendingBuys", DEVICE_KEY = "crexz-arcade.device";
  const PACKS = [
    { id: "small", coins: 100, price: "$1" },
    { id: "medium", coins: 300, price: "$2", tag: "+50%" },
    { id: "large", coins: 1000, price: "$5", tag: "+100%" },
  ];
  const MAX_AGE = 2 * 24 * 3600 * 1000; // an unpaid checkout is forgotten after 2 days
  const $ = id => document.getElementById(id);
  let open = null, busy = false;

  const call = body => fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(r => r.json());
  const readPending = () => { try { const v = JSON.parse(localStorage.getItem(PENDING_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writePending = list => localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  function device() {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, d); }
    return d;
  }

  function toast(html, ms = 4200) {
    const t = $("shop-toast");
    t.innerHTML = html;
    t.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
  }
  function setNote(text) { $("shop-note").textContent = text; }

  // ---- the shop panel ----
  function build() {
    const list = $("shop-packs");
    PACKS.forEach(p => {
      const b = document.createElement("button");
      b.className = "shop-pack";
      b.dataset.pack = p.id;
      b.innerHTML = `<i class="coin-ico"></i><span class="amt">${p.coins.toLocaleString("en-US")}</span><span class="lbl">COINS</span>` +
        (p.tag ? `<span class="tag">${p.tag}</span>` : "") + `<span class="price">${p.price}</span>`;
      b.addEventListener("click", () => buy(p.id));
      list.append(b);
    });
    $("btn-shop-close").addEventListener("click", () => { Sound.play("back"); $("shop").classList.add("hidden"); });
    document.querySelectorAll("[data-open-shop]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); show(); }));
  }

  function setButtons(on) { document.querySelectorAll(".shop-pack").forEach(b => { b.disabled = !on; }); }

  function show() {
    Sound.play("select");
    $("shop").classList.remove("hidden");
    $("shop-test").classList.add("hidden");
    if (open) { setButtons(true); setNote("SAFE CHECKOUT BY STRIPE"); }
    else { setButtons(false); setNote("CHECKING THE SHOP..."); }
    call({ action: "status" }).then(s => {
      open = !!s.open;
      setButtons(open);
      setNote(open ? "SAFE CHECKOUT BY STRIPE" : "THE COIN SHOP OPENS SOON");
      $("shop-test").classList.toggle("hidden", !s.test);
    }).catch(() => { setButtons(false); setNote(navigator.onLine === false ? "YOU'RE OFFLINE" : "SHOP NOT REACHABLE. TRY AGAIN SOON"); });
  }

  function buy(pack) {
    if (busy) return;
    busy = true;
    Sound.play("coin");
    setButtons(false);
    setNote("OPENING SECURE CHECKOUT...");
    call({ action: "checkout", pack, device: device() }).then(r => {
      if (!r.url || !r.id) throw new Error(r.error || "no checkout");
      writePending(readPending().concat({ id: r.id, t: Date.now() }));
      location.href = r.url;
    }).catch(e => {
      busy = false;
      setButtons(open);
      setNote(String(e.message) === "not_open" ? "THE COIN SHOP OPENS SOON" : "COULDN'T OPEN CHECKOUT. TRY AGAIN");
    });
  }

  // ---- collecting paid coins ----
  let claiming = false;
  async function claimAll() {
    if (claiming) return;
    const list = readPending();
    if (!list.length) return;
    claiming = true;
    let got = 0;
    const keep = [];
    for (const p of list) {
      try {
        const r = await call({ action: "claim", session: p.id });
        if (r.paid) { got += r.coins || 0; continue; }       // paid (or already collected): done with it
        if (r.error === "bad_session") continue;
        if (Date.now() - p.t < MAX_AGE) keep.push(p);         // not paid (yet): try again later
      } catch (e) { keep.push(p); }                           // offline: try again later
    }
    // others may have been added while we were asking
    const now = readPending().filter(p => !list.some(q => q.id === p.id));
    writePending(keep.concat(now));
    claiming = false;
    if (got > 0) {
      Coins.add(got);
      $("shop").classList.add("hidden");
      Sound.play("credit");
      toast(`<i class="coin-ico"></i> +${got.toLocaleString("en-US")} COINS!<br><span>THANKS FOR PLAYING</span>`);
    }
  }

  // Stripe sends the player back here with ?paid=<checkout id> or ?cancelled=1.
  function handleReturn() {
    const q = new URLSearchParams(location.search);
    const paid = q.get("paid"), cancelled = q.has("cancelled");
    if (!paid && !cancelled) return;
    history.replaceState(null, "", location.pathname);
    if (cancelled) { toast("CHECKOUT CANCELLED<br><span>NO MONEY WAS TAKEN</span>"); return; }
    if (readPending().some(p => p.id === paid)) { claimAll(); return; }
    // this browser didn't start the checkout (on iPhone: Safari, not the home-screen app)
    toast("PAYMENT DONE!<br><span>OPEN THE ARCADE FROM YOUR HOME SCREEN TO GET YOUR COINS</span>", 15000);
  }

  function init() {
    build();
    handleReturn();
    claimAll();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) claimAll(); });
    window.addEventListener("online", claimAll);
  }

  return { init, show, claimAll, PACKS };
})();
