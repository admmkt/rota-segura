import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Dentro de frame (clickjacking) não mostra a conta; antiframe.js já escondeu a página.
if (top !== self) throw new Error("em frame");

// Mesmos valores de comprar.js (Worker de pagamentos e configuração pública do Firebase).
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
// Ações sensíveis (cancelar, excluir) pedem a senha de novo: sessão aberta em computador alheio não basta.
const reautenticar = async () => {
  const senha = prompt("Confirme sua senha para continuar:");
  if (!senha) return false;
  try { await signInWithEmailAndPassword(auth, auth.currentUser.email, senha); return true; }
  catch { say("Senha incorreta."); return false; }
};
const token = async () => `Bearer ${await auth.currentUser.getIdToken()}`;
const data = d => d.toLocaleDateString("pt-BR");
const NOMES = { mensal: "Mensal", anual: "Anual", teste: "Teste", familia: "Família" };

const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
};
const erro = e => say(ERROS[e.code] || "Não deu certo. Confira a internet e tente de novo.");

let stopConta = null;

$("login").onsubmit = e => {
  e.preventDefault();
  say("");
  signInWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value)
    .then(c => { if (!c.user.emailVerified) say("Confirme seu e-mail pelo link que enviamos antes de entrar."); })
    .catch(erro);
};
$("sair").onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  stopConta?.(); stopConta = null;
  const logado = !!user?.emailVerified;
  $("entrar").hidden = logado;
  $("dados").hidden = !logado;
  if (!logado) return;
  $("contaEmail").textContent = user.email;
  // O servidor grava paidUntil, plano, assinatura e cancelamento; a tela só mostra.
  stopConta = onSnapshot(doc(db, "users", user.uid), snap => render(snap.data() || {}),
    () => say("Não foi possível ler sua conta agora."));
  carregarConta();
});

// Início, próxima cobrança e pagamentos vêm do Worker (lidos do Mercado Pago).
const STATUS_PAGAMENTO = { processed: "Paga", approved: "Paga", cancelled: "Cancelada", rejected: "Recusada" };
async function carregarConta() {
  try {
    const res = await fetch(`${WORKER_URL}/conta`, { method: "POST", headers: { Authorization: await token() } });
    if (!res.ok) throw new Error();
    const r = await res.json();
    $("inicio").textContent = r.inicio ? data(new Date(r.inicio)) : "—";
    $("proxima").textContent = r.proximaCobranca ? data(new Date(r.proximaCobranca)) : "—";
    const itens = (r.pagamentos || []).map(p => {
      const li = document.createElement("li");
      const esq = document.createElement("span");
      esq.textContent = `${p.data ? data(new Date(p.data)) : "—"} · ${p.tipo}`;
      const dir = document.createElement("span");
      dir.textContent = `R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${STATUS_PAGAMENTO[p.status] || "Pendente"}`;
      const recibo = document.createElement("button");
      recibo.type = "button";
      recibo.className = "link";
      recibo.textContent = "Recibo";
      recibo.onclick = () => mostrarRecibo(p);
      li.append(esq, dir, recibo);
      return li;
    });
    if (!itens.length) {
      const li = document.createElement("li");
      li.textContent = "Nenhum pagamento ainda.";
      itens.push(li);
    }
    $("historico").replaceChildren(...itens);
  } catch {
    say("Não foi possível carregar seus pagamentos agora.");
  }
}

function render(d) {
  const until = d.paidUntil?.toDate();
  const ativo = !!until && until > new Date();
  // Só o mensal renova sozinho. O anual também grava subscriptionId (com prefixo "anual:"), por isso o plano é checado.
  const recorrente = d.plano === "mensal" && !!d.subscriptionId;
  const cancelada = !!d.cancelouEm;

  $("plano").textContent = NOMES[d.plano] || (ativo ? "Completo" : "Gratuito");
  $("criada").textContent = d.createdAt?.toDate ? data(d.createdAt.toDate()) : "—";
  $("validade").textContent = until ? data(until) : "—";

  let texto, tom = "";
  if (!ativo) {
    texto = until
      ? `Seu acesso venceu em ${data(until)}. Para continuar, escolha um plano.`
      : "Você está no plano gratuito: recebe alertas, mas ainda não envia.";
  } else if (recorrente && !cancelada) {
    texto = `Assinatura ativa. Renova sozinha. Acesso até ${data(until)}.`;
    tom = "ok";
  } else if (recorrente) {
    texto = `Renovação cancelada. Você continua com acesso até ${data(until)}. Depois disso não há novas cobranças.`;
  } else {
    texto = `Plano ${NOMES[d.plano] || "completo"} ativo até ${data(until)}. Este plano não renova sozinho.`;
    tom = "ok";
  }
  $("status").textContent = texto;
  $("status").className = "status " + tom;

  $("baixarBtn").hidden = !ativo;
  $("comprarBtn").hidden = ativo;
  $("cancelarBtn").hidden = !(ativo && recorrente && !cancelada);
  $("trocarBtn").hidden = !(ativo && recorrente);
}

// Recibo de exibição: montado com os dados do pagamento que o servidor devolveu. Não é nota fiscal.
const DESCRICAO = { Anual: "Plano anual (12 meses)", Mensal: "Plano mensal (renovação)" };
function mostrarRecibo(p) {
  const valor = `R$ ${p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  $("reciboNum").textContent = p.id || "—";
  $("reciboData").textContent = p.data ? data(new Date(p.data)) : "—";
  $("reciboDesc").textContent = DESCRICAO[p.tipo] || p.tipo;
  $("reciboEmail").textContent = $("contaEmail").textContent;
  $("reciboValor").textContent = valor;
  $("reciboStatus").textContent = STATUS_PAGAMENTO[p.status] || "Pendente";
  $("recibo").hidden = false;
  $("recibo").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("imprimirBtn").onclick = () => window.print();
$("fecharRecibo").onclick = () => { $("recibo").hidden = true; };

$("cancelarBtn").onclick = async () => {
  if (!confirm("Cancelar a renovação? Você continua com acesso até a data da validade. Depois disso, não haverá novas cobranças.")) return;
  if (!(await reautenticar())) return;
  const btn = $("cancelarBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/cancelar`, { method: "POST", headers: { Authorization: await token() } });
    const r = await res.json().catch(() => ({}));
    if (!res.ok || !r.ok) throw new Error();
    say("Renovação cancelada. Você continua com acesso até a validade.");
    carregarConta();
  } catch {
    say("Não foi possível cancelar agora. Tente de novo.");
    btn.disabled = false;
  }
};

// Chave de teste: o Worker confere e libera 30 dias.
$("chaveBtn").onclick = async () => {
  const btn = $("chaveBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/chave`, {
      method: "POST",
      headers: { Authorization: await token(), "Content-Type": "application/json" },
      body: JSON.stringify({ key: $("chave").value.trim() }),
    });
    const r = await res.json().catch(() => ({}));
    if (res.ok) {
      say(r.ate ? `Chave aceita! Plano completo liberado até ${data(new Date(r.ate))}.` : "Chave aceita! Plano completo liberado.");
      $("chave").value = "";
    } else if (res.status === 429) say("Muitas tentativas erradas. Espere uma hora e tente de novo.");
    else if (res.status === 409) say("Essa chave já foi usada por outra conta.");
    else if (res.status === 403) say("Chave inválida ou cancelada.");
    else say("Não foi possível conferir a chave agora. Tente de novo.");
  } catch {
    say("Não foi possível conferir a chave agora. Tente de novo.");
  }
  btn.disabled = false;
};

// Excluir conta: cancela a assinatura; se houver período pago, apaga depois dele (regra do Worker).
$("excluirBtn").onclick = async () => {
  if (!confirm("Excluir sua conta? A assinatura será cancelada e não haverá novas cobranças. Se você tiver um período pago, a conta continua funcionando até o fim dele e depois é apagada com todos os dados (contatos, alertas e localização). Essa ação não pode ser desfeita.")) return;
  if (!(await reautenticar())) return;
  const btn = $("excluirBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/excluir`, {
      method: "POST",
      headers: { Authorization: await token(), "Content-Type": "application/json" },
      body: "{}",
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok || !r.ok) throw new Error();
    if (r.ate) {
      say(`Assinatura cancelada. Sua conta continua ativa até ${data(new Date(r.ate))} e depois será excluída com todos os dados.`);
    } else {
      await signOut(auth);
      say("Conta excluída.");
    }
  } catch {
    say("Não foi possível excluir a conta agora. Tente de novo.");
  }
  btn.disabled = false;
};
