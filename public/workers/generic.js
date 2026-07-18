// Generic Web Worker for process isolation
self.onmessage = function(ev) {
  const { id, type, payload } = ev.data

  try {
    if (type === 'heartbeat') {
      self.postMessage({ id, type: 'heartbeat', timestamp: Date.now() })
      return
    }

    if (type === 'inference' || type === 'code-execution') {
      const result = executeTask(type, payload)
      self.postMessage({ id, result, timestamp: Date.now() })
    } else {
      self.postMessage({ id, error: 'Unknown task type: ' + type, timestamp: Date.now() })
    }
  } catch (err) {
    self.postMessage({ id, error: err.message || 'Worker execution failed', type: 'crash', state: null, timestamp: Date.now() })
  }
}

function executeTask(type, payload) {
  if (type === 'code-execution') {
    try {
      const fn = new Function('payload', payload.code || 'return null')
      return fn(payload)
    } catch (err) {
      return { error: err.message }
    }
  }
  return null
}
