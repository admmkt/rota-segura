import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Endereço do Worker de pagamentos (worker/), preenchido depois do `wrangler deploy`.
const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";

// Configuração pública do app web do Firebase (não é segredo; quem protege os dados são as regras).
const app = initializeApp({
  apiKey: "AIzaSyCQrkSr2sT_D6_47VvasNlGzNaO3JmpvyQ",
  authDomain: "rota-segura-3a7d8.firebaseapp.com",
  projectId: "rota-segura-3a7d8",
  appId: "1:549328372452:web:1c1a5c335fefd1c851a2f1",
});
const auth = getAuth(app);
auth.languageCode = "pt-BR";
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const say = text => { $("msg").textContent = text; };

const token = async () => `Bearer ${await auth.currentUser.getIdToken()}`;
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

const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe conta com este e-mail. Use Entrar.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
};
const erro = e => say(ERROS[e.code] || "Não deu certo. Confira a internet e tente de novo.");

$("login").onsubmit = e => {
  e.preventDefault();
  say("");
  signInWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value).catch(erro);
};
$("criar").onclick = () => {
  if (!$("login").reportValidity()) return;
  say("");
  createUserWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value)
    .then(c => sendEmailVerification(c.user))
    .then(() => say("Conta criada! Enviamos um link de confirmação para o seu e-mail — confirme antes de usar o app."))
    .catch(erro);
};
$("sair").onclick = () => signOut(auth);

let stopPlan = null;
onAuthStateChanged(auth, user => {
  stopPlan?.(); stopPlan = null;
  $("login").hidden = !!user;
  $("conta").hidden = !user;
  if (!user) return;
  $("contaEmail").textContent = user.email;
  $("mpEmail").value ||= user.email;
  if (new URLSearchParams(location.search).has("pago")) {
    say("Pagamento enviado! O plano é liberado assim que o Mercado Pago confirmar — normalmente em segundos.");
    verificar(false);
  }
  // Atualiza sozinho quando o servidor confirma o pagamento.
  stopPlan = onSnapshot(doc(db, "users", user.uid), snap => {
    const d = snap.data() || {};
    const until = d.paidUntil?.toDate();
    const ativo = !!until && until > new Date();
    const membro = ativo && d.plano === "membro";
    const dia = until ? until.toLocaleDateString("pt-BR") : "";
    const NOMES = { mensal: "Plano mensal", familia: "Plano Família", anual: "Plano anual", teste: "Plano de teste" };
    $("status").textContent = !ativo
      ? "Plano gratuito: você recebe alertas, mas ainda não envia."
      : membro ? `Você está num plano família até ${dia}. Abra o app — ele já está liberado.`
      : `${NOMES[d.plano] || "Plano completo"} ativo até ${dia}. Abra o app — ele já está liberado.`;
    $("status").classList.toggle("ok", !!ativo);
    $("assinarBox").hidden = !!ativo;
    const dono = ativo && d.plano === "familia";
    $("familiaBox").hidden = !dono;
    if (dono) carregarFamilia();
    if (membro) titularFamilia();
    if (ativo) say("");
  }, () => say("Não foi possível ler seu plano agora."));
});

async function pagar(btn, path, body) {
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: "POST",
      headers: { Authorization: await token(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url?.startsWith("https://")) throw new Error(data.error);
    location.href = data.url;
  } catch (e) {
    say(e.message === "email" ? "Confira o e-mail do Mercado Pago." : "Não foi possível abrir o pagamento. Tente de novo.");
    btn.disabled = false;
  }
}
$("assinarBtn").onclick = () => pagar($("assinarBtn"), "/checkout", { payerEmail: $("mpEmail").value.trim(), plano: "mensal" });
$("familiaBtn").onclick = () => pagar($("familiaBtn"), "/checkout", { payerEmail: $("mpEmail").value.trim(), plano: "familia" });
$("anualBtn").onclick = () => pagar($("anualBtn"), "/anual", {});

// Minha família
const post = async (path, body) => {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { Authorization: await token(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
};
// O documento só tem o uid do titular; o e-mail vem do servidor.
async function titularFamilia() {
  try {
    const res = await fetch(`${WORKER_URL}/familia`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    if (data.deFamilia) $("status").textContent = `Você está no plano família de ${data.deFamilia}. Abra o app — ele já está liberado.`;
  } catch {}
}

async function carregarFamilia() {
  try {
    const { res, data } = await post("/familia", {});
    if (!res.ok) throw new Error();
    const lista = $("famLista");
    lista.replaceChildren(...(data.membros || []).map(email => {
      const li = document.createElement("li");
      const nome = document.createElement("span");
      nome.textContent = email;
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "link"; rm.textContent = "remover";
      rm.onclick = async () => {
        rm.disabled = true;
        try { await post("/familia/remover", { email }); } catch { say("Não foi possível remover agora."); }
        carregarFamilia();
      };
      li.append(nome, rm);
      return li;
    }));
    $("famContador").textContent = `${(data.membros || []).length}/${data.max ?? 4}`;
  } catch {
    say("Não foi possível carregar sua família agora.");
  }
}
const ERROS_FAM = {
  plano: "Você precisa ter o plano Família ativo para adicionar pessoas.",
  "sem-conta": "Essa pessoa ainda não criou a conta no app com esse e-mail. Peça para ela criar e tente de novo.",
  cheio: "Sua família já está completa.",
  "ja-membro": "Essa pessoa já está na sua família.",
  email: "Confira o e-mail digitado.",
};
$("famAdd").onclick = async () => {
  const btn = $("famAdd");
  btn.disabled = true;
  say("");
  try {
    const { res, data } = await post("/familia/adicionar", { email: $("famEmail").value.trim() });
    if (res.ok && data.ok) { $("famEmail").value = ""; await carregarFamilia(); }
    else say(ERROS_FAM[data.error] || "Não foi possível adicionar agora. Tente de novo.");
  } catch {
    say("Não foi possível adicionar agora. Tente de novo.");
  }
  btn.disabled = false;
};

// Confere direto no Mercado Pago (caso o aviso automático tenha se perdido); o onSnapshot mostra o resultado.
async function verificar(avisar) {
  const btn = $("verificarBtn");
  btn.disabled = true;
  try {
    const res = await fetch(`${WORKER_URL}/verificar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
    });
    const data = await res.json().catch(() => ({}));
    if (avisar && !data.ok) say(res.ok
      ? "Ainda não achamos pagamento aprovado nesta conta. Se acabou de pagar, espere alguns minutos e tente de novo."
      : "Não foi possível verificar agora. Tente de novo.");
  } catch {
    if (avisar) say("Não foi possível verificar agora. Tente de novo.");
  }
  btn.disabled = false;
}
$("verificarBtn").onclick = () => { say(""); verificar(true); };

$("excluirBtn").onclick = async () => {
  if (!confirm("Excluir sua conta? A assinatura será cancelada e não haverá novas cobranças. Se você tiver um período pago, a conta continua funcionando até o fim dele e depois é apagada com todos os dados (contatos, alertas e localização). Essa ação não pode ser desfeita.")) return;
  const btn = $("excluirBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/excluir`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error();
    if (data.ate) {
      say(`Assinatura cancelada. Sua conta continua ativa até ${new Date(data.ate).toLocaleDateString("pt-BR")} e depois será excluída com todos os dados.`);
    } else {
      await signOut(auth);
      say("Conta excluída.");
    }
  } catch {
    say("Não foi possível excluir a conta agora. Tente de novo.");
  }
  btn.disabled = false;
};

// Chave de teste: o Worker confere com o segredo MASTER_KEY e libera 30 dias; o onSnapshot mostra o resultado.
$("chaveBtn").onclick = async () => {
  const btn = $("chaveBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/chave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key: $("chave").value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      say(data.ate ? `Chave aceita! Plano completo liberado até ${new Date(data.ate).toLocaleDateString("pt-BR")}.` : "Chave aceita! Plano completo liberado.");
      $("chave").value = "";
    } else if (res.status === 409) say("Essa chave já foi usada por outra conta.");
    else if (res.status === 403) say("Chave inválida ou cancelada.");
    else say("Não foi possível conferir a chave agora. Tente de novo.");
  } catch {
    say("Não foi possível conferir a chave agora. Tente de novo.");
  }
  btn.disabled = false;
};
