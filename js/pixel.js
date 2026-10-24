// Pixel art helpers. A sprite is a list of rows; each character is a colour from the palette, "." is empty.
const Pixel = (() => {
  // Draws a sprite into a 2D context at (x, y), each art pixel `scale` units wide.
  function draw(g, rows, pal, x, y, scale = 1, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[flip ? r.length - 1 - i : i];
        if (ch === "." || ch === " ") continue;
        g.fillStyle = pal[ch] || "#f0f";
        g.fillRect(x + i * scale, y + j * scale, scale, scale);
      }
    }
  }

  // Renders a sprite once into its own small canvas, so it can be drawn quickly many times.
  function bake(rows, pal, scale = 1, flip = false) {
    const w = Math.max(...rows.map(r => r.length));
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = rows.length * scale;
    draw(c.getContext("2d"), rows, pal, 0, 0, scale, flip);
    return c;
  }

  // A spinning-coin frame, used by the insert coin screen.
  const COIN = [
    "....yyyy....",
    "..yyYYYYyy..",
    ".yYYyyyyYYy.",
    ".yYyYYYYyYy.",
    "yYyYYooYYyYy",
    "yYyYYoYYYyYy",
    "yYyYYoYYYyYy",
    "yYyYYooYYyYy",
    ".yYyYYYYyYy.",
    ".yYYyyyyYYy.",
    "..yyYYYYyy..",
    "....yyyy....",
  ];
  const COIN_PAL = { y: "#c08a00", Y: "#ffd63c", o: "#8a5a00" };

  return { draw, bake, COIN, COIN_PAL };
})();
