// Home só de apresentação: este script só mostra os preços e o aviso de promoção.
// Login, compra, plano e exclusão de conta ficam em comprar.html (comprar.js).

// Dentro de frame (clickjacking) não mostra nada; antiframe.js já escondeu a página.
if (top !== self) throw new Error("em frame");

// Endereço do Worker de pagamentos (worker/).
const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";

// Elemento que não existe nesta página vira um nó descartável (assim o resto do script continua).
const $ = id => document.getElementById(id) || document.createElement("span");
const brl = n => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const setAll = (cls, txt) => document.querySelectorAll("." + cls).forEach(e => { e.textContent = txt; });

// Preços vêm do Worker; o HTML guarda os valores padrão caso a busca falhe.
fetch(`${WORKER_URL}/precos`).then(r => r.ok ? r.json() : Promise.reject()).then(p => {
  const anual = p.promo ? p.anualAtual : p.anual;
  setAll("pMensal", brl(p.mensal));
  setAll("pFamilia", brl(p.familia));
  setAll("pAnual", brl(anual));
  setAll("pFamiliaMax", p.familiaMax);
  setAll("pFamiliaTotal", p.familiaMax + 1);
  $("precoAnual").textContent = brl(anual);
  $("equiv").textContent = brl(anual / 12);
  $("precoAntigo").textContent = `R$ ${brl(p.anual)}`;
  $("precoAntigo").hidden = !p.promo;
  $("selo").hidden = !p.promo;
  $("promoBanner").hidden = !p.promo;
  if (p.promo) {
    const ate = p.promoAte ? new Date(p.promoAte) : null;
    const dia = ate ? new Date(ate.getTime() - 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
    const dias = ate ? Math.floor((ate - Date.now()) / 864e5) : 0;
    $("selo").textContent = p.promoNome || "Promoção";
    $("promoNome").textContent = p.promoNome || "Promoção";
    $("promoBannerPreco").textContent = `R$ ${brl(anual)}`;
    $("promoBannerAntigo").textContent = `R$ ${brl(p.anual)}`;
    $("promoContagem").textContent = dia ? (dias > 1 ? `faltam ${dias} dias · até ${dia}` : `até ${dia}`) : "";
    $("promoAte").textContent = dia ? ` Preço promocional até ${dia}.` : "";
    $("descPct").textContent = `−${Math.round((1 - anual / p.anual) * 100)}%`;
    // Cronômetro ao vivo até o fim da promoção (só existe na página inicial de novembro).
    if (ate) {
      const tick = () => {
        const t = Math.max(0, ate - Date.now());
        const pad = n => String(n).padStart(2, "0");
        $("cdDias").textContent = pad(Math.floor(t / 864e5));
        $("cdHoras").textContent = pad(Math.floor(t % 864e5 / 36e5));
        $("cdMin").textContent = pad(Math.floor(t % 36e5 / 6e4));
        $("cdSeg").textContent = pad(Math.floor(t % 6e4 / 1e3));
      };
      tick();
      setInterval(tick, 1000);
    }
  }
}).catch(() => {});
