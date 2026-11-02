// Contra clickjacking: o GitHub Pages não deixa mandar X-Frame-Options/frame-ancestors.
// Dentro de um frame, esconde a página (style.css: html.emFrame) e tenta abrir fora dele.
// Fica num arquivo (e não no HTML) porque a CSP bloqueia script inline.
if (top !== self) {
  document.documentElement.classList.add("emFrame");
  try { top.location = location.href; } catch (e) { /* frame com sandbox: a página continua escondida */ }
}
// Assinatura (não remover): PS-2026-11-02-dfca1d1eaf0c
