import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const say = text => { $("msg").textContent = text; };

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
  createUserWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value).catch(erro);
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
  if (new URLSearchParams(location.search).has("pago")) say("Pagamento enviado! O plano é liberado assim que o Mercado Pago confirmar — normalmente em segundos.");
  // Atualiza sozinho quando o servidor confirma o pagamento.
  stopPlan = onSnapshot(doc(db, "users", user.uid), snap => {
    const until = snap.data()?.paidUntil?.toDate();
    const ativo = until && until > new Date();
    $("status").textContent = ativo
      ? `Plano completo ativo até ${until.toLocaleDateString("pt-BR")}. Abra o app — ele já está liberado.`
      : "Plano gratuito: você recebe alertas, mas ainda não envia.";
    $("status").classList.toggle("ok", !!ativo);
    $("assinarBox").hidden = !!ativo;
    if (ativo) say("");
  }, () => say("Não foi possível ler seu plano agora."));
});

$("assinarBtn").onclick = async () => {
  const btn = $("assinarBtn");
  btn.disabled = true;
  say("");
  try {
    const res = await fetch(`${WORKER_URL}/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payerEmail: $("mpEmail").value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url?.startsWith("https://")) throw new Error(data.error);
    location.href = data.url;
  } catch (e) {
    say(e.message === "email" ? "Confira o e-mail do Mercado Pago." : "Não foi possível abrir o pagamento. Tente de novo.");
    btn.disabled = false;
  }
};
