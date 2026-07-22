// Service worker do Desafio Mais Saude na Rotina Diaria
// Estrategia:
//   - Navegacao e index.html: REDE PRIMEIRO (garante que a versao nova aparece
//     assim que houver internet), com o cache como reserva quando estiver offline.
//   - Demais arquivos do site (icones, imagens): cache primeiro, com atualizacao
//     em segundo plano.
//   - API do Supabase (outro dominio): nunca passa por aqui.

const CACHE = "mais-saude-1_6b";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icone-192.png",
  "./icons/icone-512.png",
  "./icons/icone-512-maskable.png",
  "./img/fundo.jpg",
  "./img/fundo-escuro.jpg",
  "./icons/og-card.png"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Permite que a pagina peca a troca imediata para a versao nova
self.addEventListener("message", (ev) => {
  if (ev.data === "ATUALIZAR_AGORA") self.skipWaiting();
});

function ehDocumento(req) {
  return req.mode === "navigate" ||
         (req.destination === "document") ||
         (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (url.origin !== self.location.origin) return;      // API passa direto
  if (ev.request.method !== "GET") return;

  // 1. Paginas: rede primeiro
  if (ehDocumento(ev.request)) {
    ev.respondWith(
      fetch(ev.request, { cache: "no-store" })
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copia));
          }
          return resp;
        })
        .catch(() => caches.match(ev.request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // 2. Arquivos estaticos: cache primeiro, renovando em segundo plano
  ev.respondWith(
    caches.match(ev.request).then((hit) => {
      const busca = fetch(ev.request).then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copia));
        }
        return resp;
      }).catch(() => hit);
      return hit || busca;
    })
  );
});

self.addEventListener("push", (ev) => {
  let d = { title: "Desafio Mais Saúde", body: "" };
  try { d = ev.data.json(); } catch {}
  ev.waitUntil(self.registration.showNotification(d.title || "Desafio Mais Saúde", {
    body: d.body || "",
    icon: "icons/icone-192.png",
    badge: "icons/icone-192.png"
  }));
});

self.addEventListener("notificationclick", (ev) => {
  ev.notification.close();
  ev.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) { if ("focus" in j) return j.focus(); }
      return clients.openWindow("./");
    })
  );
});
