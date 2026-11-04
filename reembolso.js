import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Dentro de frame (clickjacking) não mostra o pedido; antiframe.js já escondeu a página.
if (top !== self) throw new Error("em frame");

// Mesmos valores de conta.js e comprar.js (Worker de pagamentos e configuração pública do Firebase).
const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";
const app = initializeApp({
  apiKey: "AIzaSyCQrkSr2sT_D6_47VvasNlGzNaO3JmpvyQ",
  authDomain: "rota-segura-3a7d8.firebaseapp.com",
  projectId: "rota-segura-3a7d8",
  appId: "1:549328372452:web:1c1a5c335fefd1c851a2f1",
});
const auth = getAuth(app);
auth.languageCode = "pt-BR";
const $ = id => document.getElementById(id);
const ocupar = (b, on) => { b.disabled = on; b.classList.toggle("carregando", on); };
const say = text => { $("msg").textContent = text; };
const brl = n => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MENSAGENS = {
  prazo: "O prazo de 7 dias para desistir já passou. Escreva para pires.softwares@gmail.com e a gente analisa o seu caso.",
  nada: "Não encontramos um pagamento anual aprovado nessa conta.",
  login: "Entre de novo para confirmar o pedido.",
  reauth: "Entre de novo para confirmar o pedido.",
  mp: "Não deu certo agora. Tente de novo em alguns minutos ou escreva para pires.softwares@gmail.com.",
};

// Pede login de novo se a sessão não é recente (o servidor aceita só login feito nos últimos 5 minutos).
const mostrarLogin = () => { $("entrar").hidden = false; $("pedido").hidden = true; };
const mostrarPedido = () => { $("entrar").hidden = true; $("pedido").hidden = false; };

onAuthStateChanged(auth, user => {
  if (user?.emailVerified) mostrarPedido(); else mostrarLogin();
});

$("entrar").onsubmit = e => {
  e.preventDefault();
  say("");
  signInWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value)
    .then(c => { if (!c.user.emailVerified) say("Confirme seu e-mail pelo link que enviamos antes de pedir o reembolso."); })
    .catch(() => say("E-mail ou senha incorretos."));
};

$("pedirBtn").onclick = async () => {
  if (!$("confirma").checked) return say("Marque a caixinha para confirmar.");
  const btn = $("pedirBtn");
  ocupar(btn, true);
  say("Enviando o pedido...");
  try {
    const res = await fetch(`${WORKER_URL}/reembolso`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
    });
    const dados = await res.json().catch(() => ({}));
    if (res.ok) {
      $("pedido").hidden = true;
      say(`Reembolso de R$ ${brl(dados.valor)} pedido. O acesso ao app foi encerrado. O valor volta pela mesma forma de pagamento; o prazo depende do Mercado Pago.`);
      return;
    }
    if (dados.error === "login" || dados.error === "reauth") { mostrarLogin(); say(MENSAGENS.reauth); return; }
    say((MENSAGENS[dados.error] || MENSAGENS.mp) + (dados.motivo ? ` (detalhe: ${dados.motivo})` : ""));
  } catch {
    say(MENSAGENS.mp);
  } finally {
    ocupar(btn, false);
  }
};
