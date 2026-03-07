// Service Worker for Web Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Innov8iv Engage', body: event.data.text() }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/innov8iv-logo.png',
    badge: '/innov8iv-logo.png',
    data: { url: payload.url },
    tag: payload.tag || 'engage-notification',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Innov8iv Engage', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url
  if (url) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Focus existing tab if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }
        // Open new tab
        return clients.openWindow(url)
      })
    )
  }
})
