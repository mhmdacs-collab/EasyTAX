/* global self */

// A newly activated release must replace any already-open SPA shell. Otherwise
// the old shell can request lazy chunks that no longer belong to production.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) =>
      Promise.all(windowClients.map((client) => client.navigate(client.url))),
    ),
  )
})
