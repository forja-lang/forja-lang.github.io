// Datos del sitio: una sola fuente para header, sidebar y footer.
export const repoUrl = "https://github.com/forja-lang/forja";
export const siteTitle = "Forja";
export const siteTagline = "Lenguaje en español";

export const headerNav = [
  { title: "Curso", href: "/curso/" },
  { title: "Sintaxis", href: "/sintaxis/variables/" },
  { title: "Arquitectura", href: "/arquitectura/pipeline/" },
  { title: "Playground", href: "/playground/" },
  { title: "Blog", href: "/blog/" },
];

export const footerNav = [
  {
    title: "Documentación",
    links: [
      { title: "¿Qué es Forja?", href: "/" },
      { title: "Instalación", href: "/instalacion/" },
      { title: "Uso (CLI)", href: "/uso/" },
      { title: "Curso en 30 días", href: "/curso/" },
      { title: "Ejemplos", href: "/ejemplos/" },
    ],
  },
  {
    title: "Proyecto",
    links: [
      { title: "Repositorio", href: repoUrl },
      { title: "Releases", href: `${repoUrl}/releases` },
      { title: "Issues", href: `${repoUrl}/issues` },
      { title: "Roadmap", href: "/roadmap/" },
      { title: "Licencia GPL-3.0", href: `${repoUrl}/blob/main/LICENSE.md` },
    ],
  },
];
