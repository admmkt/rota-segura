import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Dentro de frame (clickjacking) não liga login nem pagamento; antiframe.js já escondeu a página.
if (top !== self) throw new Error("em frame");

// Mesmos valores de app.js (Worker de pagamentos e configuração pública do Firebase).
const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";
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

// Estado da venda: a tela certa sai daqui (plano -> conta -> pagamento -> download).
// Link "Trocar para o anual" da Minha conta chega com ?plano=anual.
const planoDaUrl = new URLSearchParams(location.search).get("plano");
let plano = ["anual", "mensal", "gratis"].includes(planoDaUrl) ? planoDaUrl : null;      // "mensal" | "anual"
let usuario = null;    // conta com e-mail confirmado
let ativo = false;     // plano já liberado pelo servidor
let precos = { mensal: 9.9, anual: 79.9 };
let stopPlan = null;
let ultimoPasso = 0;

const NOMES = { mensal: "Mensal", anual: "Anual" };
const precoDo = p => (p === "anual" ? precos.anual : precos.mensal);

// Preços vêm do Worker; o HTML já traz os valores padrão.
fetch(`${WORKER_URL}/precos`).then(r => r.ok ? r.json() : Promise.reject()).then(p => {
  precos = { mensal: p.mensal, anual: p.promo ? p.anualAtual : p.anual };
  document.querySelector(".pMensal").textContent = brl(precos.mensal);
  document.querySelector(".pAnual").textContent = brl(precos.anual);
  const economia = precos.mensal * 12 - precos.anual;
  $("economia").textContent = economia > 0 ? `Você economiza R$ ${brl(economia)} por ano` : "";
}).catch(() => {});

const CRIADA = "Conta criada! Enviamos um link de confirmação para o seu e-mail. Abra o e-mail e toque no link. Não achou? Olhe na caixa de spam ou em promoções. Depois toque em “Já confirmei: entrar”.";
const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Esse e-mail já tem conta. Toque em “Já tenho conta: entrar”.",
  "auth/weak-password": "A senha precisa ter pelo menos 8 caracteres, com letras e números.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
};
const erro = e => say(ERROS[e.code] || "Não deu certo. Confira a internet e tente de novo.");

// Passo 1: escolher o plano. Ao escolher, a próxima tela aparece sozinha.
document.querySelectorAll(".escolha").forEach(b => b.onclick = () => {
  plano = b.dataset.plano;
  document.querySelectorAll(".escolha").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  say("");
  render();
});

// Voltar: troca o plano (a conta continua logada).
document.querySelectorAll("[data-voltar]").forEach(b => b.onclick = () => {
  plano = null;
  say("");
  render();
});

// Passo 2: criar conta ou entrar.
$("login").onsubmit = e => {
  e.preventDefault();
  say("");
  signInWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value)
    .then(c => {
      if (c.user.emailVerified) return;
      say(`Seu e-mail ainda não foi confirmado. Abra o link que enviamos para ${c.user.email} (veja também o spam) e entre de novo.`);
      sendEmailVerification(c.user).catch(() => {});
    })
    .catch(erro);
};
$("criar").onclick = () => {
  if (!$("login").reportValidity()) return;
  say("");
  createUserWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value)
    .then(c => sendEmailVerification(c.user))
    .then(() => {
      // Depois de criar, sai o botão Criar conta e fica em destaque o Entrar (com o mesmo e-mail e senha).
      $("criar").hidden = true;
      $("entrar").textContent = "Já confirmei: entrar";
      $("entrar").classList.remove("sec");
      say(CRIADA);
    })
    .catch(erro);
};

// Confere o plano em tempo real; o passo 4 aparece sozinho quando o servidor confirma.
onAuthStateChanged(auth, user => {
  stopPlan?.(); stopPlan = null;
  usuario = user?.emailVerified ? user : null;
  ativo = false;
  if (usuario) {
    $("mpEmail").value ||= usuario.email;
    if (new URLSearchParams(location.search).has("pago")) {
      say("Pagamento enviado! O plano é liberado assim que o Mercado Pago confirmar, normalmente em segundos.");
      verificar(false);
    }
    stopPlan = onSnapshot(doc(db, "users", usuario.uid), snap => {
      const until = snap.data()?.paidUntil?.toDate();
      ativo = !!until && until > new Date();
      if (ativo) say("");
      render();
    }, () => say("Não foi possível ler seu plano agora."));
  }
  render();
});

render(); // mostra já o plano pedido pela URL (?plano=), sem esperar o Firebase
// Mostra só a tela do passo atual e atualiza a barra de progresso.
function render() {
  // Quem já tem plano ativo só volta a comprar para trocar pelo anual.
  // Gratuito pula o pagamento: conta (passo 2) e direto para o download (passo 4).
  const gratis = plano === "gratis";
  const escolheu = plano && !(ativo && plano === "mensal");
  const passo = gratis ? (usuario ? 4 : 2) : escolheu ? (usuario ? 3 : 2) : (ativo ? 4 : 1);
  $("pagoMsg").hidden = gratis;
  $("avisoGratis").hidden = !gratis;
  $("avisoTroca").hidden = !(plano === "anual" && ativo);
  for (let n = 1; n <= 4; n++) $(`passo${n}`).hidden = n !== passo;
  $("prog").dataset.step = passo;
  $("progTxt").textContent = `Passo ${passo} de 4`;
  if (plano && !gratis) {
    $("resumoPlano").textContent = NOMES[plano];
    $("resumoValor").textContent = `R$ ${brl(precoDo(plano))}`;
    $("pagarBtn").textContent = `Pagar R$ ${brl(precoDo(plano))} agora`;
  }
  $("contaArea").hidden = !usuario;
  if (passo !== ultimoPasso) window.scrollTo({ top: 0 });
  ultimoPasso = passo;
}

// Passo 3: pagamento no Mercado Pago (mesmos endpoints do site principal).
async function pagar(btn) {
  btn.disabled = true;
  say("");
  try {
    const [path, body] = plano === "anual"
      ? ["/anual", {}]
      : ["/checkout", { payerEmail: $("mpEmail").value.trim(), plano: "mensal" }];
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: "POST",
      headers: { Authorization: await token(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    // Só redireciona para o Mercado Pago (produção ou sandbox).
    if (!res.ok || !/^https:\/\/([a-z0-9-]+\.)*(mercadopago\.com(\.br)?|mpago\.la)\//.test(data.url || "")) throw new Error(data.error);
    location.href = data.url;
  } catch (e) {
    say(e.message === "email" ? "Confira o e-mail do Mercado Pago." : "Não foi possível abrir o pagamento. Tente de novo.");
    btn.disabled = false;
  }
}
$("pagarBtn").onclick = () => pagar($("pagarBtn"));

async function verificar(avisar) {
  const btn = $("verificarBtn");
  btn.disabled = true;
  try {
    const res = await fetch(`${WORKER_URL}/verificar`, { method: "POST", headers: { Authorization: await token() } });
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
