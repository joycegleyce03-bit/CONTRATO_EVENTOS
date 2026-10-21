/* Service Worker — EventContract Hub (SEMCAS)
   - Página principal: rede primeiro (sempre pega a versão mais nova); sem internet, usa a cópia guardada.
   - Arquivos estáticos (ícones, bibliotecas de CDN): cópia guardada primeiro, atualizada em segundo plano.
   - Firebase/Firestore/Autenticação: NUNCA passam pelo cache (dados e login sempre direto do servidor).
   Ao publicar uma nova versão do sistema, aumente o número em VERSAO. */
const VERSAO = 'v1';
const CACHE = 'semcas-contratos-' + VERSAO;
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const DIRETO = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com', 'www.google-analytics.com', 'analytics.google.com', 'www.googletagmanager.com', 'firebase.googleapis.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('semcas-contratos-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (DIRETO.includes(url.hostname)) return;                       // banco e login: sem cache
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // Página: rede primeiro
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copia)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Demais arquivos: cache primeiro + atualização em segundo plano
  e.respondWith(
    caches.match(req).then(emCache => {
      const rede = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return r;
      }).catch(() => emCache);
      return emCache || rede;
    })
  );
});
