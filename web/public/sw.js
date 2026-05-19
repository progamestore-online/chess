const CACHE = 'freechess-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // SPA navigation: serve cached index.html for all same-origin page navigations
  if (e.request.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/', clone))
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Assets: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
