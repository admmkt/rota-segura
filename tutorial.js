// Monta o passo a passo interativo a partir das listas .roteiro do tutorial.html.
// Sem JS, as listas aparecem como texto com as imagens.
(() => {
  const player = document.getElementById("player");
  const caps = [...document.querySelectorAll(".roteiro")].map(ol => ({
    id: ol.dataset.cap, nome: ol.dataset.nome,
    passos: [...ol.children].map(li => ({
      img: li.dataset.img, x: li.dataset.x, y: li.dataset.y, rotulo: li.dataset.rotulo || "Toque aqui",
      titulo: li.querySelector("h3").textContent,
      corpo: [...li.children].filter(e => e.tagName !== "H3").map(e => e.outerHTML).join(""),
    })),
  }));
  if (!player || !caps.length) return;

  const $ = s => player.querySelector(s);
  const img = $(".p-img"), alvo = $(".alvo"), tabs = $(".p-tabs"), barra = $(".p-barra");
  const ant = $(".p-ant"), prox = $(".p-prox"), tela = $(".tela");
  let c = 0, i = 0, troca = 0, pronto = false;

  caps.forEach((cap, n) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "tab"); b.className = "p-tab";
    b.innerHTML = `<span>0${n + 1}</span>${cap.nome}`;
    b.onclick = () => ir(n, 0);
    tabs.append(b);
  });

  function ir(nc, ni, rolar) {
    if (nc < 0 || nc >= caps.length) return;
    const voltando = nc < c || (nc === c && ni < i);
    c = nc; i = ni;
    const cap = caps[c], p = cap.passos[i];

    [...tabs.children].forEach((t, n) => { t.setAttribute("aria-selected", n === c); t.classList.toggle("on", n === c); });
    $(".p-conta").textContent = `Passo ${i + 1} de ${cap.passos.length}`;
    $(".p-titulo").textContent = p.titulo;
    $(".p-corpo").innerHTML = p.corpo;
    $(".p-texto").classList.remove("entra"); void $(".p-texto").offsetWidth; $(".p-texto").classList.add("entra");

    barra.innerHTML = "";
    cap.passos.forEach((_, n) => {
      const d = document.createElement("button");
      d.type = "button"; d.className = "seg" + (n < i ? " feito" : n === i ? " atual" : "");
      d.setAttribute("aria-label", `Ir para o passo ${n + 1}`);
      d.onclick = () => ir(c, n);
      barra.append(d);
    });

    // Troca a imagem só depois de carregada, para não piscar a tela vazia.
    const t = ++troca, nova = new Image();
    nova.src = p.img;
    tela.classList.add("saindo"); tela.classList.toggle("volta", voltando);
    alvo.hidden = true;
    nova.decode().catch(() => {}).then(() => {
      if (t !== troca) return;
      img.src = p.img; img.alt = `Tela: ${p.titulo}`;
      alvo.style.left = p.x + "%"; alvo.style.top = p.y + "%";
      alvo.querySelector(".alvo-rotulo").textContent = p.rotulo;
      alvo.classList.toggle("esq", p.x > 70);
      alvo.classList.toggle("dir", p.x < 25);
      alvo.classList.toggle("baixo", p.y < 22);
      alvo.setAttribute("aria-label", `${p.rotulo}: avançar`);
      alvo.hidden = false;
      tela.classList.remove("saindo");
    });

    const ultimo = c === caps.length - 1 && i === cap.passos.length - 1;
    ant.disabled = c === 0 && i === 0;
    prox.textContent = ultimo ? "Recomeçar ↺" : i === cap.passos.length - 1 ? `${caps[c + 1].nome} →` : "Próximo →";

    const seguinte = caps[c].passos[i + 1] || caps[c + 1]?.passos[0];
    if (seguinte) new Image().src = seguinte.img;
    // Só depois de abrir: com # no endereço durante o carregamento, o navegador rola a página sozinho.
    if (pronto) history.replaceState(null, "", "#" + cap.id);
    if (rolar) player.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const avancar = () => {
    const cap = caps[c];
    if (i < cap.passos.length - 1) ir(c, i + 1);
    else if (c < caps.length - 1) ir(c + 1, 0);
    else ir(0, 0);
  };
  const voltar = () => {
    if (i > 0) ir(c, i - 1);
    else if (c > 0) ir(c - 1, caps[c - 1].passos.length - 1);
  };
  prox.onclick = avancar; ant.onclick = voltar; alvo.onclick = avancar;

  addEventListener("keydown", e => {
    if (e.target.closest("input, textarea") || e.altKey || e.ctrlKey || e.metaKey) return;
    const r = player.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (e.key === "ArrowRight") { e.preventDefault(); avancar(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); }
  });

  let x0 = null;
  tela.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  tela.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) dx < 0 ? avancar() : voltar();
  });

  const doHash = rolar => {
    const n = caps.findIndex(cap => "#" + cap.id === location.hash);
    if (n >= 0) ir(n, 0, rolar);
  };
  document.querySelectorAll("[data-ir]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault(); ir(caps.findIndex(cap => cap.id === a.dataset.ir), 0, true);
  }));
  addEventListener("hashchange", () => doHash(true));

  document.documentElement.classList.add("tut-js");
  player.hidden = false;
  ir(0, 0);
  doHash(location.hash === "#conta" || location.hash === "#usar");
  pronto = true;
})();
