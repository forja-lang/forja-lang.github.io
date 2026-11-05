// Resaltado de sintaxis en runtime para el código que se carga desde GitHub
// ("Ver código") y para cualquier otro texto que lo necesite.
// Forja emite las mismas clases de los snippets (.kw .fn .ty .st .co .op .nu),
// así comparte la paleta --syn-* del sitio. Rust usa highlight.js.

import hljs from "highlight.js/lib/core";
import rust from "highlight.js/lib/languages/rust";

hljs.registerLanguage("rust", rust);

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// [clase, regex] en orden: los comentarios y strings van primero para que el
// resto no coloree dentro de ellos.
const FORJA_TOKENS = [
  ["co", /\/\/[^\n]*/],
  ["co", /\/\*[\s\S]*?\*\//],
  ["st", /"(?:[^"\\]|\\.)*"/],
  ["fn", /\b(escribir|leer)\b/],
  ["ty", /\b(Booleano|Decimal|Entero|Exacto|Texto|Nulo)\b/],
  ["kw", /\b(constructor|seleccionar|implementa|coincidir|resultado|constante|importar|mientras|prestado|variable|anterior|asegura|externo|externa|funcion|recibir|repetir|romper|continuar|requiere|retornar|siempre|enviar|tiempo|cuando|clase|nuevo|rasgo|donde|canal|caso|este|hilo|otro|para|sino|tipo|unir|mut|no|si|o)\b/],
  ["kw", /\b(verdadero|falso|nulo|Alguno|Ninguno|Ok|Error|Algo|Some|None|Nada)\b/],
  ["fn", /\b[a-z_][a-zA-Z0-9_]*(?=\s*\()/],
  ["nu", /\b\d+(?:\.\d+)?\b/],
  ["op", /(->|=>|==|!=|>=|<=|&&|\|\||[+\-*\/<>=!&|])/],
];

export function resaltarForja(code) {
  // Grupos con nombre: los regex de tokens tienen grupos propios (ej. `(a|b)`),
  // así que usar índices posicionales (m[i+1]) los corrompía.
  const fuente = FORJA_TOKENS.map(([, re], i) => `(?<g${i}>${re.source})`).join("|");
  const master = new RegExp(fuente, "g");
  let out = "";
  let last = 0;
  for (const m of code.matchAll(master)) {
    out += esc(code.slice(last, m.index));
    const idx = Object.keys(m.groups ?? {}).find((k) => m.groups[k] !== undefined);
    const clase = idx ? FORJA_TOKENS[parseInt(idx.slice(1), 10)][0] : "";
    out += `<span class="${clase}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(code.slice(last));
  return out;
}

export function resaltarRust(code) {
  try {
    return hljs.highlight(code, { language: "rust" }).value;
  } catch {
    return esc(code);
  }
}
