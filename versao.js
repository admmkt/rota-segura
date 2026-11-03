// Mostra no rodapé a versão do app Android (vem de versao.json, publicado junto com o APK).
fetch("versao.json", { cache: "no-cache" })
  .then(r => r.json())
  .then(v => document.querySelectorAll("[data-versao]").forEach(el => { el.textContent = `${v.versionName} (código ${v.versionCode})`; }))
  .catch(() => {});
