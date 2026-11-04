// Assistente de ajuda (fluxo fixo, sem IA): o cliente escolhe um assunto e recebe a resposta.
// Não lê o que a pessoa digita, não grava nada e não custa nada além do /precos que o site já usa.
(() => {
  if (top !== self) return; // dentro de frame não aparece (antiframe.js)

  const WORKER_URL = "https://rota-segura-pagamentos.dgarpiedits.workers.dev";
  let precos = null;
  fetch(`${WORKER_URL}/precos`).then(r => (r.ok ? r.json() : null)).then(p => { precos = p; }).catch(() => {});
  const brl = n => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valores = () => precos
    ? `Mensal: R$ ${brl(precos.mensal)} por mês, renova sozinho todo mês. Anual: ${precos.promo ? `R$ ${brl(precos.anualAtual)} na promoção (normal R$ ${brl(precos.anual)})` : `R$ ${brl(precos.anual)}`}, pagamento único para 12 meses, sem renovação automática.`
    : "Os valores atuais estão na página Comprar.";

  const TELA = {
    inicio: { texto: "Oi! Sou o assistente do Rota Segura. Sobre o que você quer saber?", opcoes: [
      { t: "Instalar o app", ir: "instalar" },
      { t: "Criar conta e escolher plano", ir: "contratar" },
      { t: "Pagamento não apareceu", ir: "pagamento" },
      { t: "Minha conta", ir: "conta" },
      { t: "Cancelar ou trocar plano", ir: "cancelar" },
      { t: "Pedir reembolso", ir: "reembolso" },
      { t: "Contatos e alertas", ir: "contatos" },
      { t: "Falar com a equipe", ir: "humano" },
    ] },
    instalar: { texto: "Para instalar no Android:\n1) Abra o site no celular e toque em Baixar o Rota Segura.\n2) Se o Chrome avisar que o arquivo pode ser nocivo, toque em Fazer o download mesmo assim. Esse aviso aparece em todo app fora da Play Store.\n3) Abra o arquivo baixado (ou a pasta Downloads) e toque em Instalar.", opcoes: [
      { t: "Passo a passo com imagens", href: "tutorial.html#instalar" },
      { t: "Página de download", href: "baixar.html" },
    ] },
    contratar: { texto: () => `1) Escolha um plano na página Comprar.\n2) Crie sua conta com e-mail e senha (mínimo 8 caracteres, com letras e números).\n3) Confirme o link que enviamos ao seu e-mail. Se não chegar, olhe a caixa de spam.\n4) Pague com Pix ou cartão pelo Mercado Pago.\n5) Abra o app e entre com o mesmo e-mail.\n\n${valores()}`, opcoes: [
      { t: "Ir para Comprar", href: "comprar.html" },
    ] },
    pagamento: { texto: "Depois de pagar, o plano é liberado sozinho em alguns minutos.\nSe ainda não apareceu: entre em Minha conta e toque em Já paguei — conferir. Se continuar sem liberar, fale com a equipe e tenha em mãos o comprovante do Mercado Pago.", opcoes: [
      { t: "Ir para Minha conta", href: "conta.html" },
      { t: "Falar com a equipe", ir: "humano" },
    ] },
    conta: { texto: "Em Minha conta você vê a validade do plano, a próxima cobrança e os pagamentos. Também pode baixar o app, mudar seu nome, trocar para o plano anual, cancelar a renovação ou excluir a conta.", opcoes: [
      { t: "Ir para Minha conta", href: "conta.html" },
    ] },
    cancelar: { texto: "Cancelar a renovação (plano mensal): entre em Minha conta, toque em Cancelar renovação e confirme sua senha. Você continua com acesso até o fim do período já pago e não há novas cobranças.\n\nQuer trocar o mensal pelo anual? Em Minha conta, toque em Trocar para o plano anual.\n\nO plano anual não renova sozinho, então não há o que cancelar.", opcoes: [
      { t: "Ir para Minha conta", href: "conta.html" },
    ] },
    reembolso: { texto: "Você pode desistir em até 7 dias da contratação e receber de volta o valor pago (Código de Defesa do Consumidor).\n\nEntre na página Pedir reembolso com o e-mail e a senha da conta, marque a caixinha e toque em Pedir reembolso agora. O acesso ao app é encerrado na hora. O valor volta pela mesma forma de pagamento; o prazo depende do Mercado Pago.\n\nPassou de 7 dias? Fale com a equipe.", opcoes: [
      { t: "Ir para Pedir reembolso", href: "reembolso.html" },
      { t: "Falar com a equipe", ir: "humano" },
    ] },
    contatos: { texto: "Você cadastra até 3 contatos pelo e-mail que eles usam no Rota Segura. Só recebe os alertas quem aceitar o convite.\n\nO alerta manda uma sirene em tela cheia e a sua localização no mapa. Para enviar alertas é preciso ter plano. Com o plano gratuito, você recebe os alertas dos seus contatos.", opcoes: [
      { t: "Como instalar", ir: "instalar" },
    ] },
    humano: { texto: "Fale com a equipe pelo e-mail pires.softwares@gmail.com. Diga o e-mail da sua conta e o que aconteceu.\n\nA equipe nunca pede sua senha por e-mail.", opcoes: [
      { t: "Enviar e-mail", href: "mailto:pires.softwares@gmail.com?subject=Ajuda%20-%20Rota%20Segura" },
    ] },
  };

  // Monta o painel com elementos (sem innerHTML, para não abrir brecha de texto).
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "ajuda-botao";
  botao.textContent = "Ajuda";
  const painel = document.createElement("div");
  painel.className = "ajuda-painel";
  painel.hidden = true;
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-label", "Ajuda do Rota Segura");
  const cabeca = document.createElement("div");
  cabeca.className = "ajuda-cabeca";
  const titulo = document.createElement("strong");
  titulo.textContent = "Assistente Rota Segura";
  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "ajuda-fechar";
  fechar.setAttribute("aria-label", "Fechar ajuda");
  fechar.textContent = "×";
  cabeca.append(titulo, fechar);
  const conversa = document.createElement("div");
  conversa.className = "ajuda-conversa";
  conversa.setAttribute("aria-live", "polite");
  const opcoes = document.createElement("div");
  opcoes.className = "ajuda-opcoes";
  painel.append(cabeca, conversa, opcoes);
  document.body.append(botao, painel);

  const bolha = (quem, texto) => {
    const p = document.createElement("p");
    p.className = `ajuda-msg ${quem}`;
    p.textContent = texto;
    conversa.append(p);
    conversa.scrollTop = conversa.scrollHeight;
  };

  const mostrar = nome => {
    const no = TELA[nome] || TELA.inicio;
    bolha("bot", typeof no.texto === "function" ? no.texto() : no.texto);
    opcoes.replaceChildren();
    no.opcoes.forEach(o => {
      const a = document.createElement(o.href ? "a" : "button");
      a.className = "ajuda-opcao";
      a.textContent = o.t;
      if (o.href) {
        a.href = o.href;
      } else {
        a.type = "button";
        a.onclick = () => { bolha("eu", o.t); mostrar(o.ir); };
      }
      opcoes.append(a);
    });
    if (nome !== "inicio") {
      const inicio = document.createElement("button");
      inicio.type = "button";
      inicio.className = "ajuda-opcao sec";
      inicio.textContent = "Voltar ao início";
      inicio.onclick = () => { bolha("eu", "Voltar ao início"); mostrar("inicio"); };
      opcoes.append(inicio);
    }
  };

  const abrir = () => {
    painel.hidden = false;
    if (!conversa.childElementCount) mostrar("inicio");
    fechar.focus();
  };
  botao.onclick = () => (painel.hidden ? abrir() : (painel.hidden = true));
  fechar.onclick = () => { painel.hidden = true; botao.focus(); };
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !painel.hidden) { painel.hidden = true; botao.focus(); }
  });
})();
