# CREXZ Arcade

A retro arcade in your hand: original arcade games for your phone. Created by **CREXZ** (CREXZ Studios).

**Play:** https://zin34.github.io/Arcade/

On iPhone, open the link in Safari, tap **Share**, then **Add to Home Screen**. It then opens fullscreen with its own icon and works offline.

Free to play: 4 free coins every day, and good scores win coins back. No ads. See [CREDITS.md](CREDITS.md).

## Coin packs (optional)

Players can buy coin packs: 100 coins for $1, 300 for $2, 1,000 for $5. Payment happens on Stripe's own checkout page; the arcade never sees card details.

- `supabase/functions/coins` is the small server (Supabase project `crexz-arcade`). It makes the checkout page and only hands coins out after Stripe confirms the payment, once per payment.
- `supabase/purchases.sql` creates the table that remembers each purchase.
- The shop says "opens soon" until the Stripe secret key is saved in Supabase: Edge Functions → Secrets → `STRIPE_SECRET_KEY`. Use a `sk_test_` key first (the shop shows TEST MODE, no real money), then the live key.
