// Genera src/data/codigo.ts: mapea cada página de arquitectura/std a su fuente
// en GitHub (repo + ruta). Lee la nav y el repo padre (../). Re-ejecutable.
// Uso: node scripts/generar-codigo.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ_DOCS = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const RAIZ_REPO = join(RAIZ_DOCS, "..");

function walk(dir, ext, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === ".git" || f === "target" || f === "node_modules") continue;
    const p = join(dir, f);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, ext, out);
    else if (f.endsWith(ext)) out.push(relative(RAIZ_REPO, p).replace(/\\/g, "/"));
  }
  return out;
}

const CRATE_REPOS = {
  "crates/forja-syntax": "forja-lang/forja-syntax",
  "crates/forja-rt": "forja-lang/forja-rt",
  "crates/forja-wasm": "forja-lang/forja-wasm",
  "crates/forja-wasm-gui": "forja-lang/forja-wasm-gui",
  "crates/forja-gui-rt": "forja-lang/forja-gui-rt",
  "crates/forja-gui-core": "forja-lang/forja-gui-core",
  "crates/forja-android-rt": "forja-lang/forja-android-rt",
  "crates/forja-types": "forja-lang/forja-types",
  "crates/forja-theme": "forja-lang/forja-theme",
};

const srcFiles = walk(join(RAIZ_REPO, "src"), ".rs");
const crateFiles = Object.keys(CRATE_REPOS).flatMap((c) =>
  walk(join(RAIZ_REPO, c), ".rs").map((p) => p.replace(/\\/g, "/")),
);
const stdFa = walk(join(RAIZ_REPO, "stdlib", "std"), ".fa");

// ruta -> repo, para archivos fuera de src/ (crates y stdlib)
function repoDe(relPath) {
  if (relPath.startsWith("crates/")) {
    for (const [prefix, repo] of Object.entries(CRATE_REPOS)) {
      if (relPath.startsWith(prefix + "/")) return { repo, path: relPath.slice(prefix.length + 1) };
    }
  }
  if (relPath.startsWith("stdlib/std/")) return { repo: "forja-lang/forja-stdlib-std", path: relPath.slice("stdlib/std/".length) };
  if (relPath.startsWith("stdlib/gui/")) return { repo: "forja-lang/forja-stdlib-gui", path: relPath.slice("stdlib/gui/".length) };
  return { repo: "forja-lang/forja", path: relPath };
}

function basename(relPath) { return relPath.split("/").pop(); }

// índice por basename (src/ y crates)
const byBase = new Map();
for (const f of [...srcFiles, ...crateFiles]) {
  const b = basename(f);
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}
const stdBasenames = new Set(stdFa.map((f) => basename(f)));

const OVERRIDES = {
  // slug -> { repo, path }
  "vm_fast": { repo: "forja-lang/forja", path: "src/vm_fast/mod.rs" },
  "native_registry": { repo: "forja-lang/forja", path: "src/native_registry/mod.rs" },
  "error": { repo: "forja-lang/forja-syntax", path: "src/error.rs" },
  "wasm": { repo: "forja-lang/forja-wasm", path: "src/lib.rs" },
  "forja_wasm_gui": { repo: "forja-lang/forja-wasm-gui", path: "src/lib.rs" },
  "forja_android_rt": { repo: "forja-lang/forja-android-rt", path: "src/lib.rs" },
  "gui": { repo: "forja-lang/forja-gui-rt", path: "src/lib.rs" },
  "pipeline": { repo: "forja-lang/forja", path: "src/lib.rs" },
  "std": { repo: "forja-lang/forja-stdlib-std", path: "README.md" },
  "crypto_hash": { repo: "forja-lang/forja-stdlib-std", path: "crypto.fa" },
  "datos": { repo: "forja-lang/forja-stdlib-std", path: "json.fa" },
  "ffi_sistema": { repo: "forja-lang/forja-stdlib-std", path: "ffi.fa" },
  "http": { repo: "forja-lang/forja-stdlib-std", path: "cliente_http.fa" },
};

// extraer nombre del slug: /arquitectura/std/archivo/ -> archivo (o std/archivo)
function nombreDe(slug) {
  return slug.replace(/^\/arquitectura\//, "").replace(/\/+$/, "");
}

// ---- parsear nav.ts para slugs+títulos de Arquitectura + std ----
const nav = readFileSync(join(RAIZ_DOCS, "src", "data", "nav.ts"), "utf8");
const start = nav.indexOf('title: "Arquitectura"');
const end = nav.indexOf('title: "Blog"');
const seg = nav.slice(start, end);
const links = [...seg.matchAll(/\{ title: ("[^"]*"), href: ("[^"]*")(?:, sub: true)? \}/g)]
  .map((m) => ({ title: JSON.parse(m[1]), href: JSON.parse(m[2]) }));

const filenames = {
  lexer: "src/lexer.rs", token: "src/token.rs", parser: "src/parser.rs", ast: "src/ast.rs",
  semantica: "src/semantics.rs", symbol_table: "src/symbol_table.rs",
  class_descriptor: "src/class_descriptor.rs", monomorph: "src/monomorph.rs",
  optimizer: "src/optimizer.rs", ir: "src/ir.rs", ir_constructor: "src/ir_constructor.rs",
  ir_ssa: "src/ir_ssa.rs", ir_to_bytecode: "src/ir_to_bytecode.rs", stack_to_reg: "src/stack_to_reg.rs",
  register_ir: "src/register_ir.rs", register_alloc: "src/register_alloc.rs", codegen_reg: "src/codegen_reg.rs",
  formatter: "src/formatter.rs", diagrama: "src/diagrama.rs", transpilador: "src/transpiler.rs",
  compiler_asm: "src/compiler_asm.rs", compiler_llvm: "src/backend_llvm/legacy.rs",
  backend_llvm: "src/backend_llvm.rs", bytecode: "src/bytecode.rs", uops: "src/uops.rs",
  vm: "src/vm.rs", vm_jit: "src/legacy/vm_jit.rs", vm_fast: "src/vm_fast/mod.rs",
  gc: "src/gc.rs", gc_intrinsics: "src/gc_intrinsics.rs", arena: "src/arena.rs", shape: "src/shape.rs",
  jit: "src/legacy/jit.rs", jit_engine: "src/legacy/jit_engine.rs", jit_tiered: "src/jit_tiered.rs",
  pgo: "src/pgo.rs", incremental_cache: "src/incremental_cache.rs", repl: "src/repl.rs", aot: "src/aot.rs",
  selfrun: "src/selfrun.rs", module: "src/module.rs", prelude: "src/prelude.rs", ffi: "src/ffi.rs",
  package_resolver: "src/package_resolver.rs", package_config: "src/package_config.rs",
  vscode: "src/bin/forja_lsp.rs", biblioteca: "src/lib.rs", fprofiler: "src/fprofiler.rs",
  cli: "src/main.rs", debugger: "src/debugger.rs", forja_dap: "src/bin/forja_dap.rs",
  forja_lsp: "src/bin/forja_lsp.rs", error: "src/error.rs", base64: "src/base64.rs",
  crypto: "src/crypto.rs", crypto_pq: "src/crypto_pq.rs", hash: "src/hash.rs", mmap: "src/mmap.rs",
  sandbox: "src/sandbox.rs", terminal: "src/terminal.rs", native_h2_core: "src/native_h2_core.rs",
  native_h2_tls: "src/native_h2_tls.rs", native_registry: "src/native_registry/mod.rs",
  native_sqlite: "src/native_sqlite.rs", native_proceso_win: "src/native_proceso_win.rs",
  stdlib_embedded: "src/stdlib_embedded.rs",
};

const resultados = [];
const omitidos = [];
for (const { title, href } of links) {
  const name = nombreDe(href);
  const ov = OVERRIDES[name];
  const stdMatch = name.match(/^std\/(.+)$/);
  if (stdMatch && !ov) {
    const mod = stdMatch[1];
    const sov = OVERRIDES[mod];
    if (sov) {
      resultados.push({ slug: href, repo: sov.repo, path: sov.path, titulo: title });
    } else if (stdBasenames.has(`${mod}.fa`)) {
      resultados.push({ slug: href, repo: "forja-lang/forja-stdlib-std", path: `${mod}.fa`, titulo: title });
    } else {
      omitidos.push(title);
    }
    continue;
  }
  if (ov) {
    resultados.push({ slug: href, repo: ov.repo, path: ov.path, titulo: title });
    continue;
  }
  if (!filenames[name]) { omitidos.push(title); continue; }

  const candidate = filenames[name];
  // ¿existe en src/ tal cual?
  if (srcFiles.includes(candidate)) {
    resultados.push({ slug: href, repo: "forja-lang/forja", path: candidate, titulo: title });
    continue;
  }
  // por basename en src/ y crates
  const b = basename(candidate);
  const cands = byBase.get(b) || [];
  if (cands.length === 1) {
    const { repo, path } = repoDe(cands[0]);
    resultados.push({ slug: href, repo, path, titulo: title });
  } else if (cands.length > 1) {
    // elegir la de src/ raíz si existe; si no, la primera
    const pref = cands.find((c) => c === `src/${b}`) || cands[0];
    const { repo, path } = repoDe(pref);
    resultados.push({ slug: href, repo, path, titulo: title });
  } else {
    omitidos.push(`${title} (${candidate})`);
  }
}

const out = [];
out.push("// Mapeo página → fuente en GitHub. Generado por scripts/generar-codigo.mjs.");
out.push("export interface FuenteCodigo { slug: string; repo: string; path: string }");
out.push("");
out.push("export const fuentesCodigo: FuenteCodigo[] = [");
for (const r of resultados) {
  out.push(`  { slug: ${JSON.stringify(r.slug)}, repo: ${JSON.stringify(r.repo)}, path: ${JSON.stringify(r.path)} },`);
}
out.push("];");
out.push("");
out.push(`export function fuentePara(ruta: string): FuenteCodigo | undefined {`);
out.push(`  const slug = ruta.replace(/\\/+$/, "") || "/";`);
out.push(`  return fuentesCodigo.find((f) => f.slug.replace(/\\/+$/, "") === slug);`);
out.push(`}`);
out.push("");
writeFileSync(join(RAIZ_DOCS, "src", "data", "codigo.ts"), out.join("\n"), "utf8");

console.log(`Mapeadas ${resultados.length} páginas.`);
if (omitidos.length) console.log("OMITIDAS (sin fuente):\n - " + omitidos.join("\n - "));
