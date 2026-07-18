self.onmessage = function(ev) {
  const { id, type, payload } = ev.data
  try {
    if (type === 'heartbeat') { self.postMessage({ id, type: 'heartbeat', timestamp: Date.now() }); return }
    self.postMessage({ id, result: { inference: true, model: payload?.model || '' }, timestamp: Date.now() })
  } catch (err) {
    self.postMessage({ id, error: err.message || 'Worker inference failed', type: 'crash', state: null, timestamp: Date.now() })
  }
}
