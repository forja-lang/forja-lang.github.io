// Genera el sprite de iconos SVG (lucide) y reemplaza los emojis del HTML por
// <svg class="ico"><use href="#i-..."/></svg>. No toca <pre>, <code>, <script>
// ni comentarios: ahí vive código de ejemplo, no decoración.
// Uso: node scripts/iconos.mjs   (desde docs/)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// emoji -> nombre de icono lucide
const MAP = {
  "✅": "circle-check", "💡": "lightbulb", "⚠": "triangle-alert", "📝": "pencil",
  "📄": "file", "📚": "library", "⚡": "zap", "🚧": "traffic-cone", "📦": "package",
  "❌": "circle-x", "🔥": "flame", "📐": "ruler", "✏": "pencil", "🔀": "shuffle",
  "🔗": "link", "🎯": "target", "🎓": "graduation-cap", "🔧": "wrench",
  "📋": "clipboard-list", "🎨": "palette", "🧪": "flask-conical", "🌐": "globe",
  "💻": "monitor", "🪟": "app-window", "🗺": "map", "📖": "book-open",
  "📈": "trending-up", "🖥": "monitor", "🦀": "box", "🔐": "lock-keyhole",
  "🚀": "rocket", "💬": "message-circle", "📊": "bar-chart-3", "🔍": "search",
  "🔢": "hash", "⛔": "ban", "⚙": "settings", "🏗": "building-2", "🔬": "microscope",
  "📥": "download", "🔨": "hammer", "🗄": "database", "🏆": "trophy", "🖼": "image",
  "💾": "save", "🔄": "refresh-cw", "🧬": "dna", "📡": "radio-tower",
  "📜": "scroll-text", "🗑": "trash-2", "🎉": "party-popper", "🇪🇸": "flag",
  "📶": "signal", "📰": "newspaper", "🛠": "wrench", "🌀": "wind", "📁": "folder",
  "🌳": "tree-pine", "❓": "circle-help", "🧱": "brick-wall", "🏷": "tag",
  "📍": "map-pin", "🔌": "plug", "📉": "trending-down", "🧠": "brain",
  "📱": "smartphone", "🐧": "snowflake", "🍎": "apple", "♻": "recycle", "🔒": "lock",
  "👋": "hand", "🌈": "sun", "ℹ": "info", "🔤": "case-sensitive", "🚫": "ban",
  "🏃": "person-standing", "🧩": "puzzle", "🤖": "bot", "🛡": "shield", "⭐": "star",
  "🐛": "bug", "📤": "upload", "🔁": "repeat", "🧵": "spline", "👀": "eye",
  "🏭": "factory", "➕": "plus", "📢": "megaphone", "🔘": "circle", "▶": "play",
};

// Iconos extra para la interfaz (botones de ejecutar/copiar/ver código)
const EXTRA = ["code", "copy", "loader-circle", "terminal", "chevron-right", "maximize", "minimize"];

// ---------- 1) Sprite ----------
const names = [...new Set([...Object.values(MAP), ...EXTRA])].sort();
const symbols = [];
for (const name of names) {
  const p = join(RAIZ, "node_modules", "lucide-static", "icons", `${name}.svg`);
  let svg = readFileSync(p, "utf8");
  // Conservar fill/stroke del <svg> original: los paths no traen stroke propio y,
  // sin estos atributos, heredan fill:black y se ven todos negros.
  svg = svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/, (tag) =>
      tag
        .replace(/<svg/, `<symbol id="i-${name}"`)
        .replace(/\s(class|width|height|xmlns)="[^"]*"/g, ""),
    )
    .replace(/<\/svg>[\s\S]*$/, "</symbol>")
    .replace(/<!--[\s\S]*?-->\s*/g, "")
    .trim();
  symbols.push(svg);
}
const sprite = `<svg class="iconos-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols.join("")}</svg>\n`;
writeFileSync(join(RAIZ, "src", "components", "SpriteIconos.astro"), sprite, "utf8");
console.log(`Sprite: ${names.length} iconos`);

// ---------- 2) Reemplazo en fuentes ----------
function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (f.endsWith(".astro") && f !== "SpriteIconos.astro") out.push(p);
  }
  return out;
}

const files = [...walk(join(RAIZ, "src", "pages")), ...walk(join(RAIZ, "src", "components"))];

// ordenar claves por longitud descendente para que "🇪🇸" (2 code points) gane
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
const emojiRe = new RegExp(
  KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gu",
);

const ico = (name) =>
  `<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const PROTECTED = /(<(pre|code|script|svg)\b[^>]*>[\s\S]*?<\/\2>|<!--[\s\S]*?-->)/g;

let total = 0;
const manuales = [];
for (const file of files) {
  let src = readFileSync(file, "utf8");
  if (!emojiRe.test(src)) continue;

  // si hay emojis dentro de <script> se edita a mano: ahí son strings de JS
  if (/<script\b[^>]*>[\s\S]*?<\/script>/g.test(src) && (() => {
    const m = src.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) ?? [];
    return m.some((s) => emojiRe.test(s));
  })()) {
    manuales.push(relative(RAIZ, file));
    continue;
  }

  // proteger pre/code/script/comentarios con tokens
  const blocks = [];
  src = src.replace(PROTECTED, (m) => {
    blocks.push(m);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  src = src.replace(emojiRe, (m) => {
    total++;
    return ico(MAP[m]);
  });

  src = src.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  writeFileSync(file, src, "utf8");
  console.log("  " + relative(RAIZ, file) + ": " + (src.match(/class="ico"/g)?.length ?? 0));
}
console.log(`Reemplazados ${total} emojis`);
if (manuales.length) console.log("MANUALES (emoji en <script>):\n - " + manuales.join("\n - "));
