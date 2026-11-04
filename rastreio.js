// Conta visitas e cliques (cadastrar, comprar, baixar) por dia. Sem cookies, sem IP, sem dados pessoais.
(() => {
  const ENDPOINT = "https://rota-segura-pagamentos.dgarpiedits.workers.dev/evento";
  const pagina = location.pathname.split("/").pop() || "index.html";
  const enviar = nome => {
    try {
      fetch(ENDPOINT, { method: "POST", body: JSON.stringify({ nome, pagina }), keepalive: true, mode: "cors" }).catch(() => {});
    } catch {}
  };
  document.addEventListener("click", e => {
    const el = e.target.closest?.("a,button");
    if (!el) return;
    const href = el.getAttribute("href") || "";
    if (el.id === "criar") enviar("cadastrar");
    else if (el.id === "comprarBtn" || el.id === "trocarBtn" || /^comprar\.html/.test(href)) enviar("comprar");
    else if (/^baixar\.html/.test(href)) enviar("baixar");
    else if (/\.apk(\?|$)|releases\/latest\/download/.test(href)) enviar("baixou_apk");
  }, true);
  enviar("visita");
})();
