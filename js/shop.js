// The coin shop, only on CrazyGames. Payment happens in CrazyGames' own checkout (run by Xsolla);
// the arcade never sees card details. Each pack is an item in the CrazyGames/Xsolla store. After a purchase
// the arcade looks in the player's CrazyGames inventory, uses up any coin packs it finds there and adds their
// coins, so a pack is only ever turned into coins once, and one bought but not collected (say the tab closed)
// is collected next time. Buying needs a CrazyGames account, so guests are asked to sign in first.
const Shop = (() => {
  // the item ids (SKUs) to create in the Xsolla store, and the coins each gives
  const PACKS = [
    { id: "coins_100", coins: 100, price: "$1" },
    { id: "coins_300", coins: 300, price: "$2", tag: "+50%" },
    { id: "coins_1000", coins: 1000, price: "$5", tag: "+100%" },
  ];
  const $ = id => document.getElementById(id);
  const store = () => Platform.sdk().store;
  const user = () => Platform.sdk().user;
  let open = false, busy = false;

  function toast(html, ms = 4200) {
    const t = $("shop-toast");
    t.innerHTML = html;
    t.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
  }
  function setNote(text) { $("shop-note").textContent = text; }
  function setButtons(on) { document.querySelectorAll(".shop-pack").forEach(b => { b.disabled = !on; }); }

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

  // Xsolla sets each player's price (currency, sales), so show the price it gives when it gives one.
  function priceText(item) {
    const pr = item && (item.price || (item.prices && item.prices[0]));
    if (!pr || pr.amount == null) return null;
    const n = Number(pr.amount);
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: pr.currency || "USD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
    catch (e) { return String(pr.amount); }
  }

  async function show() {
    Sound.play("select");
    $("shop").classList.remove("hidden");
    setButtons(open);
    if (!open) setNote("CHECKING THE SHOP...");
    try {
      const page = await store().getCatalogItems();
      const items = (page && (page.items || page)) || [];
      const found = PACKS.filter(p => items.some(i => i.sku === p.id));
      open = found.length > 0;
      PACKS.forEach(p => {
        const item = items.find(i => i.sku === p.id), b = document.querySelector(`.shop-pack[data-pack="${p.id}"]`);
        b.classList.toggle("hidden", open && !item);
        const t = priceText(item);
        if (t) b.querySelector(".price").textContent = t;
      });
    } catch (e) { open = false; }
    setButtons(open);
    setNote(open ? "SAFE CHECKOUT BY CRAZYGAMES" : "THE COIN SHOP OPENS SOON");
  }

  async function signedIn() {
    if (!user().isUserAccountAvailable) return false;
    if (await user().getUser()) return true;
    setNote("SIGN IN TO CRAZYGAMES TO BUY");
    try { return !!(await user().showAuthPrompt()); } catch (e) { return false; }
  }

  async function buy(pack) {
    if (busy || !open) return;
    busy = true;
    Sound.play("coin");
    setButtons(false);
    try {
      if (!(await signedIn())) { setNote("SIGN IN TO CRAZYGAMES TO BUY"); return; }
      setNote("OPENING SECURE CHECKOUT...");
      await store().buyItem(pack);
      setNote("COLLECTING YOUR COINS...");
      await collect();
      setNote("SAFE CHECKOUT BY CRAZYGAMES");
    } catch (e) {
      setNote(e && e.code === "purchaseCancelled" ? "CHECKOUT CANCELLED. NO MONEY WAS TAKEN" : "COULDN'T FINISH. TRY AGAIN");
    } finally {
      busy = false;
      setButtons(open);
    }
  }

  // Turn any coin packs in the player's CrazyGames inventory into coins (using each one up first).
  let collecting = false;
  async function collect() {
    if (collecting || !Platform.crazy) return;
    collecting = true;
    let got = 0;
    try {
      if (!user().isUserAccountAvailable || !(await user().getUser())) return;
      const page = await store().getPlayerInventory();
      const items = (page && (page.items || page)) || [];
      for (const it of items) {
        const pack = PACKS.find(p => p.id === it.sku), n = Math.floor(Number(it.quantity) || 0);
        if (!pack || n <= 0) continue;
        try { await store().consumeItem(it.sku, n); } catch (e) { continue; } // not used up: leave it for next time
        got += pack.coins * n;
        Coins.add(pack.coins * n);
      }
    } catch (e) { /* offline or not signed in: try again later */ }
    finally { collecting = false; }
    if (got > 0) {
      $("shop").classList.add("hidden");
      Sound.play("credit");
      toast(`<i class="coin-ico"></i> +${got.toLocaleString("en-US")} COINS!<br><span>THANKS FOR PLAYING</span>`);
    }
  }

  function init() {
    build();
    // only CrazyGames has the shop; elsewhere the buy buttons stay hidden
    document.querySelectorAll("[data-open-shop]").forEach(b => b.classList.toggle("hidden", !Platform.crazy));
    if (!Platform.crazy) return;
    collect();
    try { user().addAuthListener(() => collect()); } catch (e) { /* ignore */ }
  }

  return { init, show, collect, toast, PACKS };
})();
