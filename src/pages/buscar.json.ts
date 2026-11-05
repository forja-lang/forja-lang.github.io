import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

/**
 * Índice de búsqueda de toda la documentación.
 *
 * Se genera en build (y en dev, en cada request) leyendo los `.astro` de
 * `src/pages`, quitando frontmatter/etiquetas/scripts y guardando el texto
 * plano. El buscador del header lo pide una sola vez y filtra en el cliente.
 */

function aTexto(fuente: string): string {
  let s = fuente.replace(/^---[\s\S]*?---/, " ");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Expresiones Astro `{...}` (una pasada; los anidados se limpian abajo).
  s = s.replace(/\{[^{}]*\}/g, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lbrace;/g, "{")
    .replace(/&rbrace;/g, "}")
    .replace(/&[a-z]+;/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

function tituloDe(fuente: string, respaldo: string): string {
  const layout = fuente.match(/<Layout[^>]*\btitle="([^"]+)"/);
  if (layout) return aTexto(layout[1]);
  const h1 = fuente.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) return aTexto(h1[1]);
  return respaldo;
}

function rutaDe(relativa: string): string {
  const sinExt = relativa.replace(/\.astro$/, "").replace(/\\/g, "/");
  if (sinExt === "index") return "/";
  if (sinExt.endsWith("/index")) return `/${sinExt.slice(0, -"/index".length)}/`;
  return `/${sinExt}/`;
}

export const GET: APIRoute = async () => {
  const raiz = path.join(process.cwd(), "src", "pages");
  const entradas: { ruta: string; titulo: string; texto: string }[] = [];

  const caminar = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        caminar(completa);
        continue;
      }
      if (!entrada.name.endsWith(".astro")) continue;
      if (entrada.name === "404.astro") continue;

      const fuente = fs.readFileSync(completa, "utf8");
      const relativa = path.relative(raiz, completa);
      const ruta = rutaDe(relativa);
      const titulo = tituloDe(fuente, relativa);
      const texto = aTexto(fuente).slice(0, 20000);
      entradas.push({ ruta, titulo, texto });
    }
  };

  caminar(raiz);

  return new Response(JSON.stringify(entradas), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
