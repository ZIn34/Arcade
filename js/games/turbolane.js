// TURBO LANE — a neon racer on a night highway that never ends. Weave through the traffic, skim past
// cars for CLOSE CALL bonuses, and grab fuel cans before the tank runs dry. The road keeps speeding up,
// and further on some drivers start switching lanes without warning.
// Drag anywhere to steer (the car moves with your finger, so your thumb never covers it).
(() => {
  Sound.defineSong("turbolane", {
    bpm: 140,
    tracks: [
      { type: "triangle", vol: 0.5, notes: Sound.notes(
        "A2 A2 A3 A2 A2 A3 A2 A3  F2 F2 F3 F2 F2 F3 F2 F3  G2 G2 G3 G2 G2 G3 G2 G3  E2 E2 E3 E2 E2 E3 G#2 B2") },
      { type: "square", vol: 0.08, notes: Sound.notes(
        "A4 - C5 - E5 - D5 C5  D5 - - - A4 - - -  B4 - D5 - G5 - F5 E5  E5 - - - G#4 - B4 -") },
      { drum: true, vol: 0.18, notes: Sound.notes("k . h k s . h .  k . h k s h s h") },
    ],
  });

  const CAR = [
    "..mmmmmm..",
    ".mmccccmm.",
    "kmmccccmmk",
    "kmmmmmmmmk",
    ".mmmmmmmm.",
    ".mmyyyymm.",
    ".mmmmmmmm.",
    "kmmmmmmmmk",
    "kmmccccmmk",
    ".mmrmmrmm.",
  ];
  const TRAFFIC_COLORS = ["#ff3c50", "#ffd63c", "#4dff7a", "#c04cff", "#ff8a3c", "#eeeeee"];

  Arcade.addGame("turbolane", {
    music: "turbolane",
    howTo: [
      "DRAG ANYWHERE TO STEER",
      "DODGE THE TRAFFIC",
      "SKIM PAST CARS FOR CLOSE CALL BONUSES",
      "GRAB FUEL CANS BEFORE YOU RUN DRY",
      "3 CARS. THE ROAD KEEPS SPEEDING UP",
    ],
    create(host) {
      let W = host.W, H = host.H;
      const LANES = 4;
      let roadW, roadX, laneW;
      function layout() { roadW = Math.min(W - 24, 360); roadX = (W - roadW) / 2; laneW = roadW / LANES; }
      layout();
      const S = Math.max(2, Math.floor(laneW / 22));
      const playerImg = Pixel.bake(CAR, { m: "#3cf0ff", c: "#0a2040", k: "#222", y: "#ffffff", r: "#ff3cc8" }, S);
      const trafficImgs = TRAFFIC_COLORS.map(c => Pixel.bake(CAR.slice().reverse(), { m: c, c: "#102030", k: "#222", y: "#333", r: "#ffd63c" }, S));
      const fx = Kit.particles(), banner = Kit.banner();
      const car = { x: roadX + laneW * 1.5 - playerImg.width / 2, y: H - playerImg.height - 50, w: playerImg.width, h: playerImg.height };
      let speed = 240, dist = 0, fuel = 100, lives = 3, invuln = 1.5, t = 0, over = false, overT = 0, bonus = 0;
      let traffic = [], cans = [], spawnT = 0.6, canT = 6, stripe = 0, finger = null, lastBanner = 0;

      const level = () => 1 + dist / 4000;
      function laneX(l) { return roadX + laneW * (l + 0.5) - playerImg.width / 2; }

      function spawnCar() {
        // never block every lane at once: leave at least one free lane in each "row"
        const lane = Kit.irand(0, LANES - 1);
        const y0 = -playerImg.height - 10;
        if (traffic.some(c => c.lane === lane && c.y < y0 + playerImg.height * 2.5)) return;
        const rowBusy = new Set(traffic.filter(c => c.y < y0 + playerImg.height * 1.8).map(c => c.lane));
        rowBusy.add(lane);
        if (rowBusy.size >= LANES) return;
        const switcher = dist > 2500 && Math.random() < Math.min(0.35, (dist - 2500) / 15000);
        // all traffic moves at the same pace, so the free lane left at each spawn stays free
        traffic.push({ lane, x: laneX(lane), y: y0, own: 0.45, img: Kit.pick(trafficImgs), passed: false, switcher, switchT: Kit.rand(0.6, 1.6), target: lane });
      }

      function crash(c) {
        if (invuln > 0) return;
        lives--;
        invuln = 2.2;
        Sound.play("boom");
        fx.burst(car.x + car.w / 2, car.y + car.h / 2, "#3cf0ff", 30, 240, 0.9, S);
        if (c) c.dead = true;
        speed = Math.max(240, speed * 0.7);
        if (lives <= 0) { over = true; overT = 1; banner.show("WRECKED!", "", "#fff", "#ff3c50", 1.2); }
        else banner.show("CRASH!", lives + (lives === 1 ? " CAR LEFT" : " CARS LEFT"), "#fff", "#ff3c50", 1);
      }

      function update(dt) {
        t += dt;
        fx.update(dt); banner.update(dt);
        if (over) { overT -= dt; if (overT <= 0) host.gameOver(); return; }
        invuln = Math.max(0, invuln - dt);
        const top = Math.min(820, 240 + dist * 0.06);
        speed += (top - speed) * Math.min(1, dt * 0.8);
        dist += speed * dt * 0.1;
        stripe = (stripe + speed * dt) % 60;
        fuel -= dt * (2.4 + level() * 0.4);
        if (fuel <= 0) { fuel = 0; over = true; overT = 1.2; Sound.play("lose"); banner.show("OUT OF FUEL!", "", "#fff", "#ffd63c", 1.4); return; }
        host.setScore(Math.floor(dist) + bonus);
        const mile = Math.floor(dist / 1000);
        if (mile > lastBanner) { lastBanner = mile; banner.show(mile * 1000 + "M", "FASTER!", "#fff", "#ff3cc8", 1); Sound.play("bonus"); host.tempo = Math.min(1.35, 1 + mile * 0.04); Sound.setTempo(host.tempo); }

        spawnT -= dt;
        if (spawnT <= 0) { spawnCar(); spawnT = Math.max(0.28, 0.95 - level() * 0.12) * Kit.rand(0.7, 1.3); }
        canT -= dt;
        if (canT <= 0) { const l = Kit.irand(0, LANES - 1); cans.push({ x: roadX + laneW * (l + 0.5) - 12, y: -30, w: 24, h: 28 }); canT = Kit.rand(3.5, 6) + level() * 0.6; }

        for (const c of traffic) {
          c.y += speed * (1 - c.own) * dt; // they drive the same way as you, only slower
          if (c.switcher) {
            c.switchT -= dt;
            if (c.switchT <= 0 && c.y > 0 && c.y < car.y - 80) {
              // only into a lane that's clear nearby, and never to close the last gap in that row
              const band = playerImg.height * 2.2;
              const opts = [c.lane - 1, c.lane + 1].filter(l => l >= 0 && l < LANES &&
                !traffic.some(o => o !== c && o.lane === l && Math.abs(o.y - c.y) < band) &&
                new Set(traffic.filter(o => o !== c && Math.abs(o.y - c.y) < band).map(o => o.lane).concat([l])).size < LANES);
              if (opts.length) { const to = Kit.pick(opts); c.blinkDir = to - c.lane; c.target = to; c.lane = to; c.blink = 0.5; }
              c.switchT = Kit.rand(1.2, 2.5);
            }
            if (c.blink) c.blink = Math.max(0, c.blink - dt);
          }
          c.x += (laneX(c.target) - c.x) * Math.min(1, dt * 3);
          // close call: passing right next to a car
          if (!c.passed && c.y > car.y + car.h) {
            c.passed = true;
            const gap = Math.max(car.x - (c.x + car.w), c.x - (car.x + car.w));
            if (gap < laneW * 0.22 && gap > -2 && invuln <= 0) {
              bonus += 50; Sound.play("point"); banner.show("CLOSE CALL!", "+50", "#fff", "#4dff7a", 0.6);
            }
          }
        }
        for (const k of cans) k.y += speed * dt;
        // hits (a slightly smaller box than the art, to feel fair)
        const hb = { x: car.x + car.w * 0.15, y: car.y + car.h * 0.1, w: car.w * 0.7, h: car.h * 0.8 };
        for (const c of traffic) if (!c.dead && Kit.hit(hb, { x: c.x + car.w * 0.15, y: c.y + car.h * 0.1, w: car.w * 0.7, h: car.h * 0.8 })) crash(c);
        for (const k of cans) if (Kit.hit(hb, k)) { k.y = H + 100; fuel = Math.min(100, fuel + 40); bonus += 25; Sound.play("power"); }
        traffic = traffic.filter(c => c.y < H + 40 && !c.dead);
        cans = cans.filter(k => k.y < H + 40);
      }

      function draw(g) {
        g.fillStyle = "#06020e"; g.fillRect(0, 0, W, H);
        // roadside neon posts scrolling past
        for (let y = -60 + stripe; y < H; y += 60) {
          g.fillStyle = "#ff3cc8"; g.fillRect(roadX - 10, y, 4, 24); g.fillStyle = "#3cf0ff"; g.fillRect(roadX + roadW + 6, y + 30, 4, 24);
        }
        g.fillStyle = "#1a1626"; g.fillRect(roadX, 0, roadW, H);
        g.fillStyle = "#ff3cc8"; g.fillRect(roadX, 0, 3, H); g.fillRect(roadX + roadW - 3, 0, 3, H);
        g.fillStyle = "#5a5470";
        for (let l = 1; l < LANES; l++) for (let y = -60 + stripe; y < H; y += 60) g.fillRect(roadX + l * laneW - 2, y, 4, 30);
        for (const k of cans) {
          g.fillStyle = "#ff3c50"; g.fillRect(k.x, k.y + 4, k.w, k.h - 4);
          g.fillStyle = "#ffd63c"; g.fillRect(k.x + 6, k.y, 12, 6); g.fillRect(k.x + 4, k.y + 10, k.w - 8, 4);
          Kit.text(g, "F", k.x + k.w / 2, k.y + k.h * 0.68, 8, "#fff");
        }
        for (const c of traffic) {
          g.drawImage(c.img, Math.round(c.x), Math.round(c.y));
          if (c.blink && Math.floor(t * 12) % 2) { g.fillStyle = "#ff8a3c"; g.fillRect(c.blinkDir < 0 ? c.x - 3 : c.x + car.w - 1, c.y + car.h - 8, 4, 4); }
        }
        if (!over && (invuln <= 0 || Math.floor(t * 10) % 2)) {
          // headlight beams
          g.fillStyle = "rgba(255,255,220,.07)";
          g.beginPath(); g.moveTo(car.x + 4, car.y); g.lineTo(car.x - 16, car.y - 120); g.lineTo(car.x + car.w + 16, car.y - 120); g.lineTo(car.x + car.w - 4, car.y); g.fill();
          g.drawImage(playerImg, Math.round(car.x), Math.round(car.y));
          if (Math.floor(t * 20) % 2) { g.fillStyle = "#ff8a3c"; g.fillRect(car.x + car.w * 0.3, car.y + car.h, 4, 5); g.fillRect(car.x + car.w * 0.6, car.y + car.h, 4, 5); }
        }
        fx.draw(g);
        // fuel gauge, lives, speed
        Kit.text(g, "FUEL", 8, 14, 8, fuel < 25 ? "#ff3c50" : "#ffd63c", "left");
        g.fillStyle = "#222"; g.fillRect(48, 9, 90, 10);
        g.fillStyle = fuel < 25 && Math.floor(t * 6) % 2 ? "#fff" : fuel < 25 ? "#ff3c50" : "#ffd63c"; g.fillRect(48, 9, 90 * fuel / 100, 10);
        Kit.text(g, Math.round(speed * 0.3) + " KM/H", W - 8, 14, 8, "#3cf0ff", "right");
        for (let i = 0; i < lives; i++) g.drawImage(playerImg, 8 + i * (playerImg.width * 0.5 + 4), 26, playerImg.width * 0.5, playerImg.height * 0.5);
        banner.draw(g, W, H);
      }

      function down(x, y) { finger = { x }; }
      function move(x) {
        if (!finger || over) return;
        car.x = Kit.clamp(car.x + (x - finger.x) * 1.3, roadX + 2, roadX + roadW - car.w - 2);
        finger = { x };
      }
      function up() { finger = null; }

      const state = () => ({ dist: Math.floor(dist), speed, fuel, lives, over, level: level(), car: { x: car.x, y: car.y, w: car.w, h: car.h }, laneW, roadX,
        traffic: traffic.map(c => ({ x: c.x, y: c.y, lane: c.lane, target: c.target })), cans: cans.map(k => ({ x: k.x, y: k.y })) });
      return { update, draw, down, move, up, state, resize(w, h) { W = w; H = h; layout(); car.y = H - car.h - 50; } };
    },
  });
})();
