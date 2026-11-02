// Home só de apresentação: este script só mostra os preços e o aviso de promoção.
// Login, compra, plano e exclusão de conta ficam em comprar.html (comprar.js).

// Dentro de frame (clickjacking) não mostra nada; antiframe.js já escondeu a página.
if (top !== self) throw new Error("em frame");

// Endereço do Worker de pagamentos (worker/).
const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";

const $ = id => document.getElementById(id);
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
    $("selo").textContent = p.promoNome || "Promoção";
    $("promoNome").textContent = p.promoNome || "Promoção";
    $("promoBannerPreco").textContent = `R$ ${brl(anual)}`;
    $("promoBannerAte").textContent = dia;
    $("promoAte").textContent = dia ? ` Preço promocional até ${dia}.` : "";
  }
}).catch(() => {});
