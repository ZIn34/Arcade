// Small helpers shared by the games: maths, particles, pixel text and banners.
// Glows are drawn as soft translucent shapes rather than canvas shadows, which are slow on iPhone.
const Kit = (() => {
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Square pixel sparks for explosions and pickups.
  function particles() {
    const list = [];
    return {
      burst(x, y, color, n = 14, speed = 160, life = 0.6, size = 3) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, s = rand(speed * 0.3, speed);
          list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, color, size });
        }
      },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.96; p.vy *= 0.96;
          p.life -= dt;
          if (p.life <= 0) list.splice(i, 1);
        }
      },
      draw(g) {
        for (const p of list) {
          g.globalAlpha = Math.max(0, p.life / p.max);
          g.fillStyle = p.color;
          g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        g.globalAlpha = 1;
      },
      clear() { list.length = 0; },
    };
  }

  // Pixel-font text with a cheap neon glow (a few offset copies underneath).
  function text(g, str, x, y, size, color, align = "center", glow = null) {
    g.font = `${size}px Pix, monospace`;
    g.textAlign = align;
    g.textBaseline = "middle";
    if (glow) {
      g.globalAlpha = 0.35;
      g.fillStyle = glow;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillText(str, x + dx, y + dy);
      g.globalAlpha = 1;
    }
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  // A message that shows in the middle of the screen for a moment ("WAVE 2", "SPEED UP!").
  function banner() {
    let msg = "", sub = "", t = 0, color = "#fff", glow = "#ff3cc8";
    return {
      show(m, s = "", c = "#fff", gl = "#ff3cc8", time = 1.6) { msg = m; sub = s; t = time; color = c; glow = gl; },
      update(dt) { t -= dt; },
      draw(g, W, H) {
        if (t <= 0) return;
        g.globalAlpha = Math.min(1, t * 3);
        text(g, msg, W / 2, H * 0.4, Math.min(24, W / 14), color, "center", glow);
        if (sub) text(g, sub, W / 2, H * 0.4 + 30, 10, "#ddd");
        g.globalAlpha = 1;
      },
      get on() { return t > 0; },
    };
  }

  // Lives drawn as little icons in a corner.
  function lives(g, n, x, y, icon) {
    for (let i = 0; i < n; i++) g.drawImage(icon, x + i * (icon.width + 4), y);
  }

  // Turns finger movement into swipes: calls onSwipe("up" | "down" | "left" | "right") each time the
  // finger travels `min` pixels, so you can keep steering without lifting. A short touch with no
  // travel counts as a tap (onTap), if given.
  function swiper(onSwipe, onTap, min = 18) {
    let start = null, moved = false;
    return {
      down(x, y) { start = { x, y }; moved = false; },
      move(x, y) {
        if (!start) return;
        const dx = x - start.x, dy = y - start.y;
        if (Math.abs(dx) < min && Math.abs(dy) < min) return;
        moved = true;
        onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
        start = { x, y };
      },
      up() { if (start && !moved && onTap) onTap(start.x, start.y); start = null; },
    };
  }

  return { rand, irand, clamp, pick, hit, particles, text, banner, lives, swiper };
})();
