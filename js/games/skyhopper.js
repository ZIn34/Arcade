// SKY HOPPER — Boing the spring-legged robot bounces up and up through the night sky. Land on platforms
// to bounce again: blue ones slide, brown ones crumble after one bounce, and yellow pads launch you high.
// Higher up the gaps widen and spiky mines drift about (bounce on top of one to knock it out).
// Tilt the phone to steer (tilt only; there are no on-screen controls). Off the sides, you wrap round.
(() => {
  Sound.defineSong("skyhopper", {
    bpm: 126,
    tracks: [
      { type: "triangle", vol: 0.45, notes: Sound.notes(
        "C3 . . C3 . . G2 .  A2 . . A2 . . E2 .  F2 . . F2 . . C3 .  G2 . . G2 . B2 D3 .") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "E5 . G5 . C6 . G5 .  A5 . E5 . C5 . E5 .  F5 . A5 . C6 . A5 .  B5 . G5 . D5 . G5 .") },
      { drum: true, vol: 0.13, notes: Sound.notes("k . h . s . h .") },
    ],
  });

  const BOING = [
    "....pppp....",
    "...pppppp...",
    "...pwkpwk...",
    "...pppppp...",
    "....pppp....",
    "...cccccc...",
    "..cccyyccc..",
    "...cccccc...",
  ];
  const BOING_PAL = { p: "#ff8ac8", w: "#ffffff", k: "#000000", c: "#3cf0ff", y: "#ffd63c" };
  // a spiky floating mine
  const DRONE = ["...rr...", ".r.rr.r.", "..rrrr..", "rrrwwrrr", "rrrwwrrr", "..rrrr..", ".r.rr.r.", "...rr..."];

  Arcade.addGame("skyhopper", {
    music: "skyhopper",
    howTo: [
      "TILT YOUR PHONE TO STEER",
      "TAP ALLOW IF YOUR PHONE ASKS ABOUT MOTION",
      "LAND ON PLATFORMS TO BOUNCE UP",
      "BROWN ONES CRUMBLE, YELLOW PADS LAUNCH",
      "BOUNCE ON MINES, DON'T BUMP THEM",
      "DON'T FALL OFF THE BOTTOM!",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const S = Math.max(2, Math.round(W / 130));
      const boingImg = Pixel.bake(BOING, BOING_PAL, S);
      const droneImg = Pixel.bake(DRONE, { r: "#ff3c50", w: "#fff" }, S);
      const fx = Kit.particles(), banner = Kit.banner();
      const G = 1500, JUMP = 760, SPRING = 1200, MAXVX = 330;
      const PW = Math.round(W * 0.17), PH = 12;

      // world y grows upward: screen y = H - (worldY - camY)
      const bot = { x: W / 2, y: 80, vx: 0, vy: JUMP, w: boingImg.width, h: boingImg.height, squash: 0 };
      let camY = 0, best = 0, platforms = [], drones = [], topY = 0, t = 0, over = false, overT = 0, started = false;
      let tiltX = null, askedTilt = false, lastMilestone = 0;
      let motion = "unknown"; // unknown, on, denied, none (no motion sensor reported anything)
      let startedAt = 0;

      const height = () => Math.floor(best / 10);            // score and difficulty both follow height
      const difficulty = () => Math.min(1, height() / 2500); // 0 at the start, 1 by 2,500

      function addPlatform(y) {
        const d = difficulty();
        const r = Math.random();
        let kind = "plain";
        if (r < 0.08 + d * 0.05) kind = "spring";
        else if (r < 0.2 + d * 0.25) kind = "move";
        else if (r < 0.3 + d * 0.3 && y > 600) kind = "crumble";
        platforms.push({ x: Kit.rand(0, W - PW), y, kind, vx: kind === "move" ? Kit.rand(50, 90 + d * 110) * (Math.random() < 0.5 ? -1 : 1) : 0, gone: false });
        // a crumbling platform is never the only way up: put a solid one nearby
        if (kind === "crumble") platforms.push({ x: Kit.rand(0, W - PW), y: y + Kit.rand(20, 40), kind: "plain", vx: 0, gone: false });
        if (y > 1500 && Math.random() < 0.05 + d * 0.12) drones.push({ x: Kit.rand(0, W - droneImg.width), y: y + 70, vx: Kit.rand(60, 120) * (Math.random() < 0.5 ? -1 : 1), dead: false });
      }
      function fillTo(y) {
        while (topY < y) {
          const d = difficulty();
          topY += Kit.rand(55 + d * 50, 85 + d * 70); // never wider than a normal bounce can reach
          addPlatform(topY);
        }
      }
      platforms.push({ x: W / 2 - PW / 2, y: 30, kind: "plain", vx: 0, gone: false });
      topY = 30;
      fillTo(H + 200);

      const sy = y => H - (y - camY);

      // Tilt: iPhone asks permission the first time (it has to be asked from a tap).
      function onTilt(e) { if (e.gamma != null) { tiltX = Kit.clamp(e.gamma / 22, -1, 1); motion = "on"; } }
      function askTilt() {
        const D = window.DeviceOrientationEvent;
        if (!askedTilt) window.addEventListener("deviceorientation", onTilt);
        askedTilt = true;
        if (D && typeof D.requestPermission === "function") {
          D.requestPermission().then(r => { if (r !== "granted") motion = "denied"; }).catch(() => { motion = "denied"; });
        }
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        if (!started) return; // waits for the first tap (which is also when iPhone asks about tilt)

        // steering is by tilt only; if no motion reading has arrived after a few seconds, show the tip
        if (motion === "unknown" && t - startedAt > 3) motion = "none";
        const steer = tiltX != null ? tiltX : 0;
        const target = steer * MAXVX;
        bot.vx += (target - bot.vx) * Math.min(1, dt * 10);
        bot.x += bot.vx * dt;
        if (bot.x < -bot.w / 2) bot.x += W; else if (bot.x > W - bot.w / 2) bot.x -= W;

        const prevY = bot.y;
        bot.vy -= G * dt;
        bot.y += bot.vy * dt;
        bot.squash = Math.max(0, bot.squash - dt * 4);

        for (const p of platforms) {
          if (p.kind === "move") { p.x += p.vx * dt; if (p.x < 0 || p.x > W - PW) { p.vx *= -1; p.x = Kit.clamp(p.x, 0, W - PW); } }
          if (p.falling) p.y -= 300 * dt;
        }
        // landing: only while falling, feet crossing the top of a platform (once zapped, you fall through)
        if (bot.vy < 0 && !bot.hurt) {
          const cx = bot.x + bot.w / 2;
          for (const p of platforms) {
            if (p.gone) continue;
            if (prevY >= p.y && bot.y <= p.y && cx > p.x - 6 && cx < p.x + PW + 6) {
              bot.y = p.y;
              if (p.kind === "spring") { bot.vy = SPRING; Sound.play("power"); fx.burst(cx, sy(p.y), "#ffd63c", 12, 160, 0.5, S); }
              else { bot.vy = JUMP; Sound.play("jump"); }
              bot.squash = 1;
              if (p.kind === "crumble") { p.gone = true; p.falling = true; Sound.noise(0.25, { vol: 0.2, freq: 1200 }); fx.burst(cx, sy(p.y), "#8a5a30", 10, 120, 0.5, S); }
              break;
            }
          }
        }
        // drones: stomp from above, or bump into one and fall
        for (const d of drones) {
          if (d.dead) { d.y -= 400 * dt; continue; }
          d.x += d.vx * dt;
          if (d.x < 0 || d.x > W - droneImg.width) d.vx *= -1;
          const hitX = bot.x + bot.w * 0.2 < d.x + droneImg.width && bot.x + bot.w * 0.8 > d.x;
          const hitY = bot.y < d.y + droneImg.height && bot.y + bot.h > d.y;
          if (hitX && hitY && !bot.hurt) {
            if (bot.vy < 0 && bot.y > d.y + droneImg.height * 0.4) {
              d.dead = true; bot.vy = JUMP * 1.1; host.addScore(50);
              Sound.play("hit"); fx.burst(d.x + droneImg.width / 2, sy(d.y), "#ff3c50", 14, 180, 0.6, S);
            } else if (!bot.hurt) {
              bot.hurt = true; bot.vy = Math.min(bot.vy, 0) - 200; bot.vx *= -0.5;
              Sound.play("boom"); banner.show("ZAP!", "", "#fff", "#ff3c50", 0.8);
            }
          }
        }

        // camera follows upward only
        if (!bot.hurt && bot.y - camY > H * 0.55) camY = bot.y - H * 0.55;
        if (bot.y > best) {
          best = bot.y;
          host.setScore(height() + bonus);
          if (Math.floor(height() / 500) > lastMilestone) {
            lastMilestone = Math.floor(height() / 500);
            banner.show(lastMilestone * 500 + "M!", "", "#fff", "#3cf0ff", 1);
            Sound.play("bonus");
            host.tempo = Math.min(1.35, 1 + lastMilestone * 0.05);
            Sound.setTempo(host.tempo);
          }
        }
        fillTo(camY + H + 200);
        platforms = platforms.filter(p => p.y > camY - 60);
        drones = drones.filter(d => d.y > camY - 60);

        if (sy(bot.y) > H + 40) {
          over = true; overT = 0.8;
          Sound.play("lose");
          banner.show("FELL!", height() + "M", "#fff", "#ff3cc8", 1.2);
        }
      }
      // the score is the height climbed plus any drone-stomp bonuses
      let bonus = 0;
      host.addScore = n => { bonus += n; host.setScore(height() + bonus); };

      function draw(g) {
        // sky gets darker and starrier the higher you go
        const k = difficulty();
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, k > 0.5 ? "#02000a" : "#0a0630");
        grad.addColorStop(1, k > 0.5 ? "#100630" : "#2a0a5a");
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) {
          const x = (i * 97) % W, y = ((i * 53 + camY * 0.1) % H + H) % H;
          g.fillStyle = i % 3 ? "#556" : "#fff";
          g.fillRect(x, H - y, 2, 2);
        }
        // far-off city at the very start
        if (camY < H) {
          g.fillStyle = "#1a0a3a";
          for (let i = 0; i < 9; i++) { const bh = 40 + ((i * 37) % 70); g.fillRect(i * W / 9, sy(-10) - bh + 40, W / 9 - 4, bh + 200); }
        }
        for (const p of platforms) {
          const y = Math.round(sy(p.y)), x = Math.round(p.x);
          if (y < -20 || y > H + 20) continue;
          const col = p.kind === "move" ? "#3c8cff" : p.kind === "crumble" ? "#8a5a30" : p.kind === "spring" ? "#4dff7a" : "#4dff7a";
          g.fillStyle = col; g.fillRect(x, y, PW, PH);
          g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(x, y, PW, 3);
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x, y + PH - 3, PW, 3);
          if (p.kind === "crumble") { g.fillStyle = "#3a2010"; g.fillRect(x + PW * 0.3, y + 3, 2, PH - 4); g.fillRect(x + PW * 0.65, y + 2, 2, PH - 5); }
          if (p.kind === "spring") { g.fillStyle = "#ffd63c"; g.fillRect(x + PW / 2 - 10, y - 8, 20, 8); g.fillStyle = "#c08a00"; g.fillRect(x + PW / 2 - 6, y - 4, 12, 2); }
        }
        for (const d of drones) {
          const y = sy(d.y) - droneImg.height;
          if (d.dead) g.globalAlpha = 0.4;
          g.drawImage(droneImg, Math.round(d.x), Math.round(y + Math.sin(t * 8 + d.x) * 2));
          g.globalAlpha = 1;
        }
        // Boing, squashed a little just after a bounce, with springy legs
        const bx = Math.round(bot.x), by = Math.round(sy(bot.y));
        const legs = Math.round(8 + 10 * (1 - bot.squash) * (bot.vy > 0 ? 1 : 0.6));
        g.fillStyle = "#cccccc";
        for (let i = 0; i < legs; i += 4) { g.fillRect(bx + bot.w * 0.3 + (i % 8 ? 3 : 0), by - legs + i, 4, 2); g.fillRect(bx + bot.w * 0.6 + (i % 8 ? 3 : 0), by - legs + i, 4, 2); }
        for (const ox of [0, bot.x > W - bot.w ? -W : null, bot.x < 0 ? W : null]) {
          if (ox === null) continue;
          g.drawImage(boingImg, bx + ox, by - legs - boingImg.height);
        }
        fx.draw(g);
        Kit.text(g, height() + "M", W - 8, 14, 10, "#fff", "right");
        if (!started && Math.floor(t * 2) % 2 === 0) Kit.text(g, "TAP TO START", W / 2, H * 0.4, 12, "#fff", "center", "#ff8ac8");
        else if (started && (motion === "denied" || motion === "none")) motionTip(g);
        else if (started && motion !== "on" && t - startedAt < 3) Kit.text(g, "TILT TO STEER", W / 2, H - 20, 8, "#aaa");
        // the two touch halves, shown faintly while held
        banner.draw(g, W, H);
      }

      // Shown when the phone won't share motion: how to turn it on.
      function motionTip(g) {
        const w = W - 40, h = 150, x = 20, y = H * 0.3;
        g.fillStyle = "rgba(0,0,0,.85)"; g.fillRect(x, y, w, h);
        g.strokeStyle = "#ff8ac8"; g.lineWidth = 2; g.strokeRect(x, y, w, h);
        const lines = motion === "denied"
          ? ["SKY HOPPER NEEDS MOTION", "", "CLOSE THE ARCADE FULLY,", "OPEN IT AGAIN, START SKY HOPPER", "AND TAP ALLOW WHEN ASKED"]
          : ["NO TILT FOUND", "", "SKY HOPPER IS STEERED BY", "TILTING YOUR PHONE.", "TAP HERE TO ASK AGAIN"];
        lines.forEach((l, i) => Kit.text(g, l, W / 2, y + 24 + i * 24, i === 0 ? 10 : 8, i === 0 ? "#fff" : "#ddd", "center", i === 0 ? "#ff8ac8" : null));
      }

      // Taps don't steer. The first tap starts the game (and is when iPhone asks about motion);
      // tapping while the tip is showing asks again.
      function down() {}
      function move() {}
      // iPhone only lets a page ask for motion when a finger lifts
      function up() {
        if (!started) { askTilt(); started = true; startedAt = t; Sound.play("select"); }
        else if (motion === "none") { askedTilt = true; askTilt(); startedAt = t; motion = "unknown"; }
      }
      function destroy() { window.removeEventListener("deviceorientation", onTilt); }

      const state = () => ({ started, tilt: tiltX, motion, height: height(), over, camY, difficulty: difficulty(),
        bot: { x: bot.x + bot.w / 2, y: bot.y, vx: bot.vx, vy: bot.vy }, W,
        platforms: platforms.filter(p => !p.gone).map(p => ({ x: p.x, w: PW, y: p.y, kind: p.kind, vx: p.vx })),
        drones: drones.filter(d => !d.dead).map(d => ({ x: d.x, y: d.y })) });
      return { update, draw, down, move, up, destroy, state, resize(w, h) { W = w; H = h; } };
    },
  });
})();
