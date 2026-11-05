/**
 * Buscador global de la documentación.
 *
 * Pide `/buscar.json` (índice generado en build desde `src/pages`) la primera
 * vez que se abre y después filtra en memoria. No usa dependencias.
 */

type Entrada = { ruta: string; titulo: string; texto: string };
type Resultado = Entrada & { snippet: string };

const normalizar = (texto: string) =>
  (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

let indice: Entrada[] | null = null;
let cargando: Promise<Entrada[]> | null = null;
let activo = -1;

const overlay = () => document.querySelector<HTMLElement>("[data-search]");
const campo = () => document.querySelector<HTMLInputElement>("[data-search-input]");

async function asegurarIndice(): Promise<Entrada[]> {
  if (indice) return indice;
  if (!cargando) {
    cargando = fetch("/buscar.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((datos: Entrada[]) => {
        indice = Array.isArray(datos) ? datos : [];
        return indice;
      });
  }
  return cargando;
}

function abrir() {
  const contenedor = overlay();
  if (!contenedor) return;
  contenedor.hidden = false;
  document.documentElement.style.overflow = "hidden";
  const entrada = campo();
  if (entrada) {
    entrada.value = "";
    entrada.focus();
  }
  pintar([], "");
  asegurarIndice();
}

function cerrar() {
  const contenedor = overlay();
  if (!contenedor || contenedor.hidden) return;
  contenedor.hidden = true;
  document.documentElement.style.overflow = "";
}

function recorte(texto: string, posicion: number): string {
  const inicio = Math.max(0, posicion - 80);
  const fin = Math.min(texto.length, posicion + 120);
  return (inicio > 0 ? "…" : "") + texto.slice(inicio, fin).trim() + (fin < texto.length ? "…" : "");
}

function pintar(lista: Resultado[], consulta: string) {
  const contenedor = overlay();
  if (!contenedor) return;
  const caja = contenedor.querySelector<HTMLElement>("[data-search-results]");
  const vacio = contenedor.querySelector<HTMLElement>("[data-search-empty]");
  if (!caja) return;

  caja.replaceChildren();
  activo = -1;
  if (vacio) vacio.hidden = !(consulta.length > 0 && lista.length === 0);

  for (const resultado of lista) {
    const enlace = document.createElement("a");
    enlace.className = "search-result";
    enlace.href = resultado.ruta;

    const titulo = document.createElement("span");
    titulo.className = "search-result-title";
    titulo.textContent = resultado.titulo;

    const snippet = document.createElement("span");
    snippet.className = "search-result-snippet";
    snippet.textContent = resultado.snippet;

    enlace.append(titulo, snippet);
    caja.append(enlace);
  }
}

async function buscar(consulta: string) {
  const datos = await asegurarIndice();
  // Si el usuario siguió escribiendo, esta respuesta ya no sirve.
  if ((campo()?.value ?? "").trim() !== consulta.trim()) return;

  const terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) {
    pintar([], "");
    return;
  }

  const encontrados: (Resultado & { puntos: number })[] = [];
  for (const entrada of datos) {
    const titulo = normalizar(entrada.titulo);
    const texto = normalizar(entrada.texto);
    let puntos = 0;
    let posicion = -1;
    let sirve = true;

    for (const termino of terminos) {
      const enTitulo = titulo.includes(termino);
      const enTexto = texto.indexOf(termino);
      if (!enTitulo && enTexto === -1) {
        sirve = false;
        break;
      }
      if (enTitulo) puntos += 6;
      if (enTexto !== -1) {
        puntos += 1;
        if (posicion === -1) posicion = enTexto;
      }
    }

    if (!sirve) continue;
    const pos = posicion === -1 ? 0 : posicion;
    encontrados.push({ ...entrada, snippet: recorte(entrada.texto, pos), puntos });
  }

  encontrados.sort((a, b) => b.puntos - a.puntos || a.ruta.localeCompare(b.ruta));
  pintar(encontrados.slice(0, 25), consulta);
}

function mover(delta: number) {
  const contenedor = overlay();
  if (!contenedor) return;
  const items = Array.from(contenedor.querySelectorAll<HTMLElement>(".search-result"));
  if (items.length === 0) return;
  activo = (activo + delta + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle("is-active", i === activo));
  items[activo].scrollIntoView({ block: "nearest" });
}

// Con el ClientRouter el módulo puede re-ejecutarse: registrar los listeners
// una sola vez por documento.
const yaIniciado = (window as unknown as { __forjaBusqueda?: boolean }).__forjaBusqueda === true;
(window as unknown as { __forjaBusqueda?: boolean }).__forjaBusqueda = true;

if (!yaIniciado) document.addEventListener("click", (event) => {
  const objetivo = event.target as HTMLElement | null;
  if (!objetivo) return;

  if (objetivo.closest("[data-search-open]")) {
    abrir();
    return;
  }
  if (objetivo.closest("[data-search-close]")) {
    cerrar();
    return;
  }
  if (objetivo.closest(".search-result")) {
    cerrar();
    return;
  }
  const contenedor = overlay();
  if (contenedor && !contenedor.hidden && objetivo === contenedor) cerrar();
});

if (!yaIniciado) document.addEventListener("input", (event) => {
  const entrada = event.target as HTMLInputElement | null;
  if (!entrada?.matches("[data-search-input]")) return;
  buscar(entrada.value);
});

if (!yaIniciado) document.addEventListener("keydown", (event) => {
  const contenedor = overlay();

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (contenedor && !contenedor.hidden) cerrar();
    else abrir();
    return;
  }
  if (!contenedor || contenedor.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    cerrar();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    mover(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    mover(-1);
    return;
  }
  if (event.key === "Enter") {
    const items = Array.from(contenedor.querySelectorAll<HTMLAnchorElement>(".search-result"));
    const destino = items[activo >= 0 ? activo : 0];
    if (destino) {
      event.preventDefault();
      destino.click();
    }
  }
});
