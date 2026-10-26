// CREXZ Arcade coin shop, running on Supabase.
// Makes a secure Stripe checkout page for a coin pack, and later checks with Stripe that a payment really
// went through before handing out its coins (each payment only once). The Stripe secret key lives in this
// project's secrets as STRIPE_SECRET_KEY; until it's set, the shop reports itself as "not open yet".
import { createClient } from "jsr:@supabase/supabase-js@2";

const PACKS: Record<string, { coins: number; cents: number; name: string }> = {
  small: { coins: 100, cents: 100, name: "100 arcade coins" },
  medium: { coins: 300, cents: 200, name: "300 arcade coins" },
  large: { coins: 1000, cents: 500, name: "1,000 arcade coins" },
};
const SITE = "https://zin34.github.io/Arcade/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function stripe(path: string, method: "GET" | "POST", form?: Record<string, string>) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + Deno.env.get("STRIPE_SECRET_KEY"), "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe error");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const packs = Object.fromEntries(Object.entries(PACKS).map(([id, p]) => [id, { coins: p.coins, cents: p.cents }]));
    if (body.action === "status") return json({ open: !!key, test: key.startsWith("sk_test_"), packs });
    if (!key) return json({ error: "not_open" }, 503);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body.action === "checkout") {
      const pack = PACKS[body.pack];
      if (!pack) return json({ error: "bad_pack" }, 400);
      const device = String(body.device || "").slice(0, 64);
      const s = await stripe("checkout/sessions", "POST", {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.cents),
        "line_items[0][price_data][product_data][name]": pack.name,
        success_url: SITE + "?paid={CHECKOUT_SESSION_ID}",
        cancel_url: SITE + "?cancelled=1",
        "metadata[pack]": body.pack,
        "metadata[device]": device,
      });
      await db.from("purchases").insert({ session_id: s.id, pack: body.pack, coins: pack.coins, amount_cents: pack.cents, device_id: device });
      return json({ url: s.url, id: s.id });
    }

    if (body.action === "claim") {
      const id = String(body.session || "");
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "bad_session" }, 400);
      const s = await stripe("checkout/sessions/" + id, "GET");
      if (s.payment_status !== "paid") return json({ paid: false });
      // hand the coins out once: only a purchase not yet claimed gets updated
      const { data } = await db.from("purchases")
        .update({ status: "claimed", claimed_at: new Date().toISOString() })
        .eq("session_id", id).neq("status", "claimed").select();
      if (!data || !data.length) return json({ paid: true, coins: 0, already: true });
      return json({ paid: true, coins: data[0].coins });
    }

    return json({ error: "bad_action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
