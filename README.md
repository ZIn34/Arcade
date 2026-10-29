# CREXZ Arcade

A retro arcade in your hand: original arcade games for your phone. Created by **CREXZ** (CREXZ Studios).

**Play:** https://zin34.github.io/Arcade/

On iPhone, open the link in Safari, tap **Share**, then **Add to Home Screen**. It then opens fullscreen with its own icon and works offline.

Free to play: 4 free coins every day, and good scores win coins back. No ads. See [CREDITS.md](CREDITS.md).

## CrazyGames version

`python tools/make_crazygames.py` makes `dist/crazygames.zip`, the copy to upload to CrazyGames. It adds the CrazyGames SDK; there the arcade saves coins and scores to the player's CrazyGames account and reports gameplay start/stop.

Coin packs are sold only on CrazyGames (an invite-only feature that runs through their Xsolla store): 100 coins for $1, 300 for $2, 1,000 for $5. Create three consumable items in the Xsolla store with these item ids (SKUs): `coins_100`, `coins_300`, `coins_1000`. Until they exist the shop says "opens soon". After a purchase the arcade uses up the pack from the player's inventory and adds its coins, so each pack counts once.
