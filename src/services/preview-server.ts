import { spawn, ChildProcess } from 'child_process'
import * as net from 'net'
import { request } from 'http'

interface PreviewInstance {
  process: ChildProcess
  port: number
  url: string
}

const previewInstances = new Map<string, PreviewInstance>()

async function getAvailablePort(startPort: number = 3000): Promise<number> {
  const net = await import('net')
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(startPort, () => {
      const port = (srv.address() as net.AddressInfo).port
      srv.close((err) => resolve(port))
    })
    srv.on('error', (err: any) => {
      resolve(getAvailablePort(startPort + 1))
    })
  })
}

async function waitForPort(port: number, host: string = 'localhost', timeoutMs: number = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = request({ hostname: host, port, path: '/', method: 'HEAD', timeout: 1000 }, (res) => resolve())
        req.on('error', () => reject())
        req.end()
      })
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Server on port ${port} did not respond within ${timeoutMs}ms`)
}

export async function startPreviewServer(id: string, workdir: string, command: string = 'npm run dev'): Promise<{ url: string; port: number }> {
  if (previewInstances.has(id)) {
    return { url: previewInstances.get(id)!.url, port: previewInstances.get(id)!.port }
  }

  const port = await getAvailablePort(3000)
  const url = `http://localhost:${port}`

  const [cmd, ...args] = command.split(' ')

  const proc = spawn(cmd, [...args, '--port', String(port)], {
    cwd: workdir,
    env: { ...process.env, PORT: String(port) },
    shell: true,
  })

  proc.on('error', (err) => {
    console.error(`Preview server ${id} error:`, err)
  })

  proc.on('exit', () => {
    previewInstances.delete(id)
  })

  previewInstances.set(id, { process: proc, port, url })

  // Wait for the dev server to actually respond before returning
  await waitForPort(port, 'localhost', 30000)

  return { url, port }
}

export function stopPreviewServer(id: string) {
  const instance = previewInstances.get(id)
  if (instance) {
    instance.process.kill()
    previewInstances.delete(id)
  }
}

export function getPreviewUrl(id: string): string | null {
  return previewInstances.get(id)?.url || null
}
