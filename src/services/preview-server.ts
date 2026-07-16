import { spawn, ChildProcess } from 'child_process'

interface PreviewInstance {
  process: ChildProcess
  port: number
  url: string
}

const previewInstances = new Map<string, PreviewInstance>() // Keyed by projectId or conversationId

// Simple getPort without external dependency
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

  await new Promise(resolve => setTimeout(resolve, 3000))

  proc.on('error', (err) => {
    console.error(`Preview server ${id} error:`, err)
  })

  proc.on('exit', () => {
    previewInstances.delete(id)
  })

  previewInstances.set(id, { process: proc, port, url })

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
