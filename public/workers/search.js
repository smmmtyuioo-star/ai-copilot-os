self.onmessage = function(ev) {
  const { id, type, payload } = ev.data
  try {
    if (type === 'heartbeat') { self.postMessage({ id, type: 'heartbeat', timestamp: Date.now() }); return }
    self.postMessage({ id, result: { queried: true, query: payload?.query || '' }, timestamp: Date.now() })
  } catch (err) {
    self.postMessage({ id, error: err.message || 'Worker search failed', type: 'crash', state: null, timestamp: Date.now() })
  }
}
