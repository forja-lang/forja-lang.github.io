// Verifica en Chrome headless que navegar al playground sin recargar la página
// aplica su CSS (display:grid) y que el editor WASM arranca.
// Uso: node scripts/verificar-navegacion.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const BASE = '';
const PUERTO = 4600 + Math.floor(Math.random() * 200);
const PUERTO_CDP = 9400 + Math.floor(Math.random() * 200);

const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.json': 'application/json', '.ico': 'image/x-icon',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(BASE)) { res.writeHead(404).end('fuera del base'); return; }
  p = p.slice(BASE.length) || '/';
  const archivo = normalize(join(dist, p));
  if (!archivo.startsWith(dist)) { res.writeHead(403).end(); return; }
  let cuerpo;
  let destino = archivo;
  try {
    cuerpo = await readFile(archivo);
  } catch {
    destino = join(dist, p, 'index.html');
    try { cuerpo = await readFile(destino); } catch { res.writeHead(404).end('no encontrado'); return; }
  }
  res.writeHead(200, { 'content-type': tipos[extname(destino)] || 'application/octet-stream' });
  res.end(cuerpo);
});
await new Promise((r) => server.listen(PUERTO, '127.0.0.1', r));

const URL_INICIO = `http://127.0.0.1:${PUERTO}${BASE}/`;
const PERFIL = join(raiz, '.chrome-test-' + PUERTO);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1400,900',
  `--remote-debugging-port=${PUERTO_CDP}`, `--user-data-dir=${PERFIL}`,
  URL_INICIO,
], { stdio: 'ignore' });

async function paginaObjetivo() {
  for (let i = 0; i < 80; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/list`)).json();
      const page = lista.find((t) => t.type === 'page' && t.webSocketDebuggerUrl && t.url.includes(`127.0.0.1:${PUERTO}`));
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chrome no expuso ninguna pestaña');
}

const ws = new WebSocket(await paginaObjetivo());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pendientes = new Map();
const erroresConsola = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    erroresConsola.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    erroresConsola.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const cdp = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await cdp('Runtime.enable');
await cdp('Page.enable');

const evaluar = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

// Esperar a que la portada esté lista
for (let i = 0; i < 60; i++) {
  if (await evaluar(`document.readyState === 'complete' && !!document.querySelector('[data-nav] a')`)) break;
  await new Promise((r) => setTimeout(r, 250));
}

const portada = await evaluar(`({ url: location.pathname, links: document.querySelectorAll('[data-nav] a').length })`);
if (portada.links === 0) {
  throw new Error('La portada no cargó: ' + JSON.stringify(portada));
}

const fallosDemo = [];

// 0) La demo de la portada: el chip "Contratos" ejecuta sin error
const chip = `[...document.querySelectorAll('[data-demo-example]')].find(c => c.textContent.includes('Contratos'))`;
if (await evaluar(`!!${chip}`)) {
  await evaluar(`${chip}.click(); true`);
  await new Promise((r) => setTimeout(r, 3000));
  const demo = await evaluar(`
    (() => {
      const out = document.querySelector('[data-demo-output]');
      return { salida: out ? out.textContent.trim().slice(0, 80) : null };
    })()
  `);
  console.log('Demo de la portada (chip Contratos) →', JSON.stringify(demo));
  if (!/10 \/ 2 = 5/.test(demo.salida || '')) fallosDemo.push(`el chip Contratos no ejecutó: ${demo.salida}`);
}

// 1) Navegar al playground con un click, como un usuario
await evaluar(`document.querySelector('[data-nav] a[href="/playground/"]').click(); true`);
await new Promise((r) => setTimeout(r, 4000));

const estado = await evaluar(`
  (() => {
    const layout = document.querySelector('.playground-layout');
    const editor = document.getElementById('codigo');
    const out = document.getElementById('output');
    return {
      url: location.pathname,
      hayLayout: !!layout,
      display: layout ? getComputedStyle(layout).display : null,
      columnas: layout ? getComputedStyle(layout).gridTemplateColumns.split(' ').length : 0,
      altoEditor: editor ? Math.round(editor.getBoundingClientRect().height) : 0,
      textoOutput: out ? out.textContent.trim().slice(0, 120) : null,
      estilosInline: document.querySelectorAll('head style').length,
    };
  })()
`);

console.log('Tras click en el sidebar →', JSON.stringify(estado, null, 2));

const fallos = [...fallosDemo];
if (!estado.hayLayout) fallos.push('no se insertó el markup del playground');
if (estado.display !== 'grid') fallos.push(`.playground-layout display=${estado.display} (esperado grid) => el CSS de la página NO se aplicó`);
if (estado.columnas !== 2) fallos.push(`grid con ${estado.columnas} columnas (esperado 2)`);
if (estado.altoEditor < 100) fallos.push(`el editor mide ${estado.altoEditor}px (sin estilo)`);
if (!/Hola, mundo desde Forja/.test(estado.textoOutput || '')) fallos.push(`la salida no muestra el resultado de la ejecución: ${estado.textoOutput}`);

// 2) El ejemplo de GUI debe renderizarse en el canvas al apretar ▶ Ejecutar
const hayEjemploGui = await evaluar(`!![...document.querySelectorAll('.example-btn')].find(b => b.textContent.includes('GUI'))`);
let gui;
if (hayEjemploGui) {
  await evaluar(`[...document.querySelectorAll('.example-btn')].find(b => b.textContent.includes('GUI')).click(); true`);
  await new Promise((r) => setTimeout(r, 4000));
  gui = await evaluar(`
    (() => {
      const c = document.getElementById('forja-canvas');
      const status = document.getElementById('status');
      let colores = 0;
      if (c) {
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const vistos = new Set();
        for (let i = 0; i < d.length; i += 4 * 97) vistos.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
        colores = vistos.size;
      }
      return {
        visible: c ? !c.hidden && getComputedStyle(c).display !== 'none' : false,
        enOutput: c ? c.parentElement?.classList.contains('output-panel') : false,
        colores,
        status: status ? status.textContent.trim() : null,
      };
    })()
  `);
  console.log('Ejemplo GUI →', JSON.stringify(gui));
  if (!gui.visible) fallos.push('el canvas GUI no se mostró');
  if (!gui.enOutput) fallos.push('el canvas GUI no está dentro del panel de output');
  if (gui.colores < 3) fallos.push(`el canvas GUI quedó vacío (${gui.colores} colores)`);
  if (/error|no disponible|⛔/i.test(gui.status || '')) fallos.push(`estado del GUI: ${gui.status}`);
  if (!/\d+\.?\d*\s*ms/.test(gui.status || '')) fallos.push(`estado del GUI no muestra tiempo: ${gui.status}`);
}

// 3) Volver atrás: no deben quedar estilos huérfanos del playground
await evaluar('history.back(); true');
await new Promise((r) => setTimeout(r, 3000));
const atras = await evaluar(`({ url: location.pathname, quedoCssPlayground: [...document.querySelectorAll('head style')].some(s => s.textContent.includes('.playground-layout')) })`);
console.log('Tras volver atrás →', JSON.stringify(atras));
// El playground ahora es un componente compartido (index + /playground/), así
// que sus estilos globales viven en el <head> de ambas páginas: es esperado
// que persistan al volver a la portada. La comprobación queda solo informativa.
if (atras.quedoCssPlayground) console.log('ℹ estilos del playground presentes en la portada (componente compartido)');

// 4) Entrar directo por URL (sin navegación client-side)
await cdp('Page.navigate', { url: `http://127.0.0.1:${PUERTO}${BASE}/playground/` });
await new Promise((r) => setTimeout(r, 4000));
const directo = await evaluar(`
  (() => {
    const layout = document.querySelector('.playground-layout');
    const out = document.getElementById('output');
    return {
      url: location.pathname,
      display: layout ? getComputedStyle(layout).display : null,
      columnas: layout ? getComputedStyle(layout).gridTemplateColumns.split(' ').length : 0,
      textoOutput: out ? out.textContent.trim().slice(0, 120) : null,
    };
  })()
`);
console.log('Carga directa de /playground/ →', JSON.stringify(directo));
if (directo.display !== 'grid') fallos.push(`carga directa: display=${directo.display} (esperado grid)`);
if (directo.columnas !== 2) fallos.push(`carga directa: ${directo.columnas} columnas (esperado 2)`);
if (!/Hola, mundo desde Forja/.test(directo.textoOutput || '')) fallos.push(`carga directa: la salida es '${directo.textoOutput}'`);

if (erroresConsola.length) console.log('Errores de consola:\n - ' + erroresConsola.join('\n - '));

ws.close();
chrome.kill();
server.close();
await new Promise((r) => setTimeout(r, 500));
await rm(PERFIL, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
if (fallos.length) { console.log('\n❌ ' + fallos.join('\n❌ ')); process.exit(1); }
console.log('\n✅ Navegación al playground con diseño y ejecución OK');
