// Palco fixo atrás da página inteira com um único celular 3D (index.html: #estagio).
// 1) Cena do alerta (#cena): a rolagem define o alvo; a linha do tempo anda até ele com velocidade máxima,
//    mais lenta nos trechos de texto, para cada frase ficar legível ~3 s mesmo com rolagem rápida.
// 2) Depois, cada elemento [data-fone] leva o celular a uma nova pose e tela (a tela apaga e acende a cada cena).
// Com "reduzir movimento": estado final da cena, sem animação.
(() => {
  const doc = document.documentElement;
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const estreito = matchMedia("(max-width: 899px)");
  const est = document.getElementById("estagio"), cena = document.getElementById("cena"), palco = document.getElementById("palco");
  const foneA = document.getElementById("foneA"), foneB = document.getElementById("foneB");
  if (!est || !cena || !palco || !foneA || !foneB) return;
  doc.classList.add("js");
  if (reduzir) doc.classList.add("reduzir");

  const clamp = v => Math.min(1, Math.max(0, v));
  const fase = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const sete = (el, k, v) => el.style.setProperty(k, typeof v === "number" ? v.toFixed(3) : v);

  // Entrada ao rolar de textos e cartões.
  if (!reduzir && "IntersectionObserver" in window) {
    doc.classList.add("js-anim");
    const alvos = document.querySelectorAll(".wrap > h2, .wrap > p, .steps li, .checks li, .plan, .internet, .card, .ponte, .passo h3, .passo p");
    const obs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("vis"); obs.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    alvos.forEach(el => { if (!el.closest("footer")) { el.classList.add("rev"); obs.observe(el); } });
  }

  // ---- Linha do tempo da cena (d de 0 a 1). x em vw e y em vh a partir do centro; ry/rx/rz em graus ----
  // Celular A. Colunas: p, x, y, s, ry, rx, rz (desktop) e x, y, s (celular).
  const KA = [
    [0.000,   0, 75, 1.00, 180, -4, -5,    0, 75, 1.00],
    [0.090,   0,  4, 0.74, 200, -8, -2,    0,  6, 0.70],
    [0.170,   0,  0, 0.62, 360,  3,  0,    0,  4, 0.58],
    [0.220,   0,  0, 0.62, 360,  3,  0,    0,  4, 0.58],
    [0.250,  22,  0, 0.56, 344,  4,  0,    0, 18, 0.50],
    [0.440,  22,  0, 0.56, 338,  4,  0,    0, 18, 0.50],
    [0.480,  -6,  8, 0.96, 360,  2,  0,    0, 12, 0.62],
    [0.600,  -6,  8, 0.96, 360,  2,  0,    0, 12, 0.62],
    [0.680,  -6,  8, 0.96, 360,  2,  0,    0, 12, 0.62],
    [0.820,  -6,  8, 0.96, 360,  2,  0,    0, 12, 0.62],
    [0.880, -22, -6, 0.50, 378,  4,  0,  -24,-12, 0.33],
    [1.000, -22, -6, 0.50, 378,  4,  0,  -24,-12, 0.33]
  ];
  const KB = [ // p, x, y, s, op (desktop) e x, y, s (celular)
    [0.00, 75, -6, 0.50, 0,   75, -12, 0.33],
    [0.64, 75, -6, 0.50, 0,   75, -12, 0.33],
    [0.70, 22, -6, 0.50, 1,   24, -12, 0.33],
    [1.00, 22, -6, 0.50, 1,   24, -12, 0.33]
  ];
  const FRASES = [[0.245, 0.31], [0.31, 0.375], [0.375, 0.44]];
  // velocidade máxima (fração da cena por segundo): frases ~4 s cada; telas e close no alerta ~2 s
  const taxa_unused = d => (d >= 0.245 && d < 0.44) || (d >= 0.875 && d < 0.94) ? 0.0148 : (d >= 0.46 && d < 0.60) || (d >= 0.775 && d < 0.82) ? 0.025 : 0.075;

  function chave(tab, d, cols) {
    let i = 0;
    while (i < tab.length - 2 && d > tab[i + 1][0]) i++;
    const a = tab[i], b = tab[i + 1], t = ease(fase(d, a[0], b[0]));
    return cols.map(c => mix(a[c], b[c], t));
  }
  function poseCena(d, mv) {
    const [x, y, s, ry, rx, rz, mx, my, ms] = chave(KA, d, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const [bx, by, bs, op, bmx, bmy, bms] = chave(KB, d, [1, 2, 3, 4, 5, 6, 7]);
    return {
      a: { x: mv ? mx : x, y: mv ? my : y, s: mv ? ms : s, ry, rx, rz },
      b: { x: mv ? bmx : bx, y: mv ? bmy : by, s: mv ? bms : bs, ry: -18, rx: 4, rz: 0, op }
    };
  }

  // ---- Poses das seções ([data-fone]); data-giro dá uma volta inteira ao entrar ----
  const ancoras = [...document.querySelectorAll("[data-fone]")];
  let voltas = 0;
  // Lado do celular por seção: +1 direita (texto à esquerda), -1 esquerda (texto à direita).
  // Seções que ocupam a largura toda (planos, minha conta) mantêm o celular à direita.
  const LADO_ESQ = new Set(["dois-apps", "instalacao"]);
  const poses = ancoras.map((el, i) => {
    if (el.dataset.giro) voltas++;
    const esq = LADO_ESQ.has(el.id);
    const lado = esq ? -1 : 1;
    if (esq) el.classList.add("texto-dir");
    // De frente (múltiplos de 360°) quando alinhado ao texto.
    const ry = 360 * voltas;
    return {
      d: { x: (esq ? -31 : 25), y: 0, s: 0.56 - i * 0.014, ry, rx: 0, rz: 0 },
      m: { x: 0, y: 0, s: 0.48 - i * 0.012, ry, rx: 0, rz: 0 }
    };
  });

  // ---- Luz: escurece cada face conforme ela se afasta da luz (alto, à esquerda, à frente) ----
  const L = [-0.35, -0.45, 0.82];
  function luz(el, ry, rx) {
    const a = ry * Math.PI / 180, b = rx * Math.PI / 180;
    const lam = (x, y, z) => {
      const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
      const y2 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
      return Math.max(0, x1 * L[0] + y2 * L[1] + z2 * L[2]);
    };
    sete(el, "--sf", 0.55 * (1 - lam(0, 0, 1)));
    sete(el, "--sb", 0.75 * (1 - lam(0, 0, -1)));
    sete(el, "--sl", 0.85 * (1 - lam(-1, 0, 0)));
    sete(el, "--sr", 0.85 * (1 - lam(1, 0, 0)));
    sete(el, "--gx", (50 - Math.sin(a) * 60).toFixed(1) + "%");
  }
  function aplica(el, p) {
    sete(el, "--x", p.x); sete(el, "--y", p.y); sete(el, "--s", p.s);
    sete(el, "--ry", p.ry); sete(el, "--rx", p.rx); sete(el, "--rz", p.rz);
    luz(el, p.ry, p.rx);
  }
  const telasA = [...foneA.querySelectorAll(".tela img")];
  function tela(nome) { telasA.forEach(im => im.classList.toggle("on", im.dataset.t === nome)); }

  const feixe = document.getElementById("feixe"), cabeca = est.querySelector(".sinal"), anel = est.querySelector(".impacto");
  const frases = [...est.querySelectorAll(".frase")], protecao = est.querySelector(".protecao"), rolar = est.querySelector(".rolar");
  const somBtn = document.getElementById("somBtn");

  let disparou = false, sirenePlay = false, somOn = false;
  function desenha(d) {
    const mv = estreito.matches, vw = innerWidth / 100, vh = innerHeight / 100;
    const W = palco.offsetWidth, H = palco.offsetHeight;
    const { a, b } = poseCena(d, mv);

    // Progresso de cada âncora: 0 quando o topo dela entra por baixo, 1 quando chega perto do topo.
    const A0 = mv ? 1.0 : 0.95, A1 = mv ? 0.8 : 0.6;
    const ts = ancoras.map(el => {
      const t = clamp((A0 * innerHeight - el.getBoundingClientRect().top) / (A1 * innerHeight));
      return reduzir ? (t > 0.5 ? 1 : 0) : t;
    });
    const t0 = ts[0] || 0, sai = ease(t0);

    // Pose do A: cena, depois cada seção por cima (composição em sequência = sem saltos).
    let pa = a, nomeTela = "motorista"; // a cena mostra o app em uso; cadastro fica nas seções seguintes
    let offA = 1 - fase(d, 0.185, 0.225);
    ts.forEach((t, i) => {
      if (t <= 0) return;
      const alvo = mv ? poses[i].m : poses[i].d, e = ease(t);
      pa = { x: mix(pa.x, alvo.x, e), y: mix(pa.y, alvo.y, e), s: mix(pa.s, alvo.s, e), ry: mix(pa.ry, alvo.ry, e), rx: mix(pa.rx, alvo.rx, e), rz: mix(pa.rz, alvo.rz, e) };
      if (t >= 0.5) nomeTela = ancoras[i].dataset.fone;
      // cada cena começa bloqueada: a tela apaga na troca e acende quando o celular chega
      offA = reduzir ? 0 : Math.max(i === 0 ? offA * (1 - fase(t, 0, 0.4)) : 0, Math.min(fase(t, 0.05, 0.4), 1 - fase(t, 0.6, 0.95)));
    });
    // Tremor no clique: o celular treme por um instante quando o botão é pressionado.
    const tremorC = reduzir ? 0 : fase(d, 0.60, 0.605) * (1 - fase(d, 0.605, 0.64));
    const sacode = tremorC * Math.sin((d - 0.6) * 5200);
    aplica(foneA, { ...pa, x: pa.x + sacode * 0.9, y: pa.y + sacode * 0.4 });
    tela(nomeTela);
    sete(foneA, "--off", offA);

    // Celular B (quem recebe): só na cena; sai para a direita quando a página começa.
    const impacto = fase(d, 0.775, 0.785) * (1 - fase(d, 0.785, 0.81));
    const pb = { x: mix(b.x, 80, sai), y: b.y, s: b.s * (1 + 0.07 * impacto), ry: b.ry, rx: b.rx, rz: 0 };
    aplica(foneB, pb);
    sete(foneB, "--op", b.op * (1 - sai));
    sete(foneB, "--off", 1 - fase(d, 0.775, 0.795));

    // Toque no botão.
    const toque = fase(d, 0.60, 0.607) * (1 - fase(d, 0.612, 0.63));
    sete(foneA, "--press", toque * (1 - sai)); sete(foneA, "--pscale", 0.6 + 0.6 * toque);

    // Textos: frases uma por vez; proteção no fim; somem quando a página começa.
    const vis = 1 - fase(t0, 0, 0.35);
    frases.forEach((f, i) => {
      const [s0, s1] = FRASES[i];
      sete(f, "--o", Math.min(fase(d, s0, s0 + 0.007), 1 - fase(d, s1 - 0.007, s1)) * vis);
    });
    if (protecao) sete(protecao, "--o", ease(fase(d, 0.875, 0.89)) * vis);
    if (rolar) sete(rolar, "--o", 1 - fase(d, 0, 0.03));

    // Sinal: centros dos celulares em px no palco; a cabeça viaja de A até B.
    const cA = { x: W / 2 + a.x * vw, y: H / 2 + a.y * vh }, cB = { x: W / 2 + b.x * vw, y: H / 2 + b.y * vh };
    const tt = ease(fase(d, 0.69, 0.775));
    const hx = mix(cA.x, cB.x, tt), hy = mix(cA.y, cB.y, tt);
    if (feixe) {
      sete(feixe, "--fx", cA.x + "px"); sete(feixe, "--fy", cA.y + "px");
      sete(feixe, "--len", Math.hypot(cB.x - cA.x, cB.y - cA.y) + "px");
      sete(feixe, "--ang", Math.atan2(cB.y - cA.y, cB.x - cA.x) * 180 / Math.PI + "deg");
      sete(feixe, "--fe", tt * (1 - fase(d, 0.84, 0.865)) * (1 - sai));
    }
    if (cabeca) {
      sete(cabeca, "--hx", hx + "px"); sete(cabeca, "--hy", hy + "px");
      sete(cabeca, "--hop", fase(d, 0.685, 0.69) * (1 - fase(d, 0.775, 0.78)));
    }
    if (anel) {
      sete(anel, "--ix", cB.x + "px"); sete(anel, "--iy", cB.y + "px");
      sete(anel, "--ir", 0.3 + 3.2 * fase(d, 0.775, 0.81));
      sete(anel, "--io", fase(d, 0.775, 0.778) * (1 - fase(d, 0.785, 0.81)));
    }

    // Câmera: acompanha a cabeça do sinal, close em B, impacto (tremor) e recua para os dois.
    const zMax = mv ? 1.5 : 1.75;
    let z = 1;
    if (d >= 0.68) z = d < 0.73 ? mix(1, 1.45, ease(fase(d, 0.68, 0.73))) : d < 0.775 ? mix(1.45, zMax, ease(fase(d, 0.73, 0.775))) : d < 0.82 ? zMax : mix(zMax, 1, ease(fase(d, 0.82, 0.87)));
    let fx = mix(W / 2, hx, ease(fase(d, 0.68, 0.71))), fy = mix(H / 2, hy, ease(fase(d, 0.68, 0.71)));
    fx = mix(fx, cB.x, ease(fase(d, 0.765, 0.78))); fy = mix(fy, cB.y, ease(fase(d, 0.765, 0.78)));
    fx = mix(fx, W / 2, ease(fase(d, 0.82, 0.87))); fy = mix(fy, H / 2, ease(fase(d, 0.82, 0.87)));
    const tremor = d >= 0.775 && d < 0.80 ? 14 * (1 - fase(d, 0.775, 0.80)) * Math.sin((d - 0.775) * 2400) : 0;
    z = mix(z, 1, sai);
    const tx = mix(W / 2 - z * fx + tremor, 0, sai), ty = mix(H / 2 - z * fy + tremor * 0.5, 0, sai);
    palco.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + z.toFixed(3) + ")";

    sete(est, "--flash", Math.max(toque * 0.35, impacto * 0.8) * (1 - sai));
    sete(est, "--halo", 0.7 - 0.3 * fase(d, 0.78, 0.9));
    if (somBtn) somBtn.classList.toggle("sai", t0 >= 1);

    if (reduzir) return;
    if (d >= 0.60 && d < 0.68 && !disparou) {
      disparou = true;
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) { /* sem vibração */ }
    } else if (d < 0.55) disparou = false;
    marcosEm(d);
  }

  // ---- Som (Web Audio, só depois de um toque no botão) ----
  // ---- Sons de efeito (Web Audio, sintetizados: sem arquivos). Começam ligados; o navegador libera o áudio no primeiro gesto. ----
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, ruido = null;
  try { somOn = localStorage.getItem("rs-som") !== "0"; } catch (e) { somOn = true; }
  function audio() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), dados = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
      ruido = buf;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // Ruído filtrado com varredura de frequência: whoosh (sobe ou desce), riser (sobe e cresce)
  function varredura(ini, fim, dur, vol, tipo, f0, f1) {
    const c = audio(); if (!c || !somOn) return;
    const t = c.currentTime, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = ruido; flt.type = tipo; flt.Q.value = 0.9;
    flt.frequency.setValueAtTime(ini, t); flt.frequency.exponentialRampToValueAtTime(fim, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(c.destination); src.start(t, Math.random(), dur);
  }
  const whoosh = (sobe) => sobe ? varredura(300, 4200, 0.9, 0.09, "bandpass") : varredura(4000, 260, 0.9, 0.09, "bandpass");
  const riser = () => varredura(200, 6000, 1.4, 0.06, "highpass");
  // Impacto grave: seno que cai + estouro de ruído
  function impacto() {
    const c = audio(); if (!c || !somOn) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.7);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.95);
    varredura(2500, 400, 0.35, 0.12, "lowpass");
  }
  // Clique curto no botão
  function clique() {
    const c = audio(); if (!c || !somOn) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.1);
  }
  function sirene(seg) {
    const c = audio(); if (!c || !somOn) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.setValueAtTime(700, t);
    for (let k = 1; k * 0.4 <= seg; k++) o.frequency.linearRampToValueAtTime(k % 2 ? 1250 : 700, t + k * 0.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.05);
    g.gain.setValueAtTime(0.035, t + seg - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + seg);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + seg);
  }
  // Primeiro gesto libera o áudio (política dos navegadores)
  // Só clique, toque ou tecla liberam o áudio (rolagem não conta como gesto para o navegador)
  const GESTOS = ["pointerdown", "keydown", "touchend"];
  let rotula = () => {};
  const liberar = () => { audio(); GESTOS.forEach(ev => removeEventListener(ev, liberar)); rotula(); };
  GESTOS.forEach(ev => addEventListener(ev, liberar, { passive: true }));
  const bloqueado = () => somOn && (!ctx || ctx.state !== "running");
  if (somBtn) {
    if (!AC) somBtn.remove();
    else {
      rotula = () => { somBtn.textContent = !somOn ? "Ativar som" : bloqueado() ? "Toque para ativar o som" : "Som ligado"; somBtn.setAttribute("aria-pressed", somOn ? "true" : "false"); };
      rotula();
      somBtn.addEventListener("click", () => {
        somOn = !somOn;
        try { localStorage.setItem("rs-som", somOn ? "1" : "0"); } catch (e) { /* ignora */ }
        rotula();
        if (somOn) { audio(); whoosh(true); }
      });
    }
  }
  // Disparos por posição da rolagem (uma vez por cruzamento, com intervalo mínimo)
  const marcos = [
    { at: 0.04, fn: () => whoosh(true) },   // celular sobe
    { at: 0.20, fn: () => whoosh(false) },  // vira de frente
    { at: 0.46, fn: () => whoosh(true) },   // frases
    { at: 0.52, fn: () => whoosh(true) },   // troca de tela
    { at: 0.575, fn: riser },               // sobe a tensão antes do clique
    { at: 0.60, fn: clique },               // clique
    { at: 0.68, fn: () => whoosh(true) },   // sinal sai
    { at: 0.775, fn: () => { impacto(); sirene(1.6); } }, // impacto e alerta
    { at: 0.88, fn: () => whoosh(false) }   // recua
  ];
  let ultimoD = 0, ultimoMarco = -1;
  function marcosEm(d) {
    const subindo = d >= ultimoD; ultimoD = d;
    marcos.forEach((m, i) => {
      if (subindo && ultimoD0 < m.at && d >= m.at) { m.fn(); }
    });
    ultimoD0 = d;
  }
  let ultimoD0 = 0;
  const ultimo_ = null;

  // ---- Laço: d persegue o alvo da rolagem com velocidade limitada ----
  const alvoCena = () => {
    const r = cena.getBoundingClientRect(), h = cena.offsetHeight - innerHeight;
    return h > 0 ? clamp(-r.top / h) : 1;
  };
  const inicio = ancoras[0];
  let d = reduzir ? 1 : alvoCena(), ultimo = 0, pedido = 0;
  function quadro(agora) {
    pedido = 0;
    const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0.016;
    ultimo = agora;
    const alvo = reduzir ? 1 : alvoCena();
    const fora = inicio && inicio.getBoundingClientRect().top < innerHeight * 0.35;
    const dif = alvo - d;
    // Acompanha a rolagem de perto (suavização de ~0,12 s), sem limite de velocidade: a cena anda com o scroll.
    if (reduzir || fora || Math.abs(dif) < 0.0004) d = alvo;
    else d += dif * (1 - Math.exp(-dt / 0.12));
    desenha(d);
    if (d !== alvo) pedido = requestAnimationFrame(quadro);
    else ultimo = 0;
  }
  const agenda = () => { if (!pedido) pedido = requestAnimationFrame(quadro); };
  addEventListener("scroll", agenda, { passive: true });
  addEventListener("resize", agenda);
  agenda();
})();
