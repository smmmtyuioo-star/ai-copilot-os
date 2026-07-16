import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Tool as MCPToolDef } from '@modelcontextprotocol/sdk/types.js'

export interface MCPEndpoint {
  id: string
  name: string
  url: string
  protocol: string
}

const mcpClients = new Map<string, { client: Client; tools: MCPToolDef[] }>()

export async function connectMCPEndpoint(endpoint: MCPEndpoint): Promise<{ client: Client; tools: MCPToolDef[] }> {
  const existing = mcpClients.get(endpoint.id)
  if (existing) return existing

  const urlStr = `${endpoint.protocol}://${endpoint.url}`
  
  // Connect via SSE (Server-Sent Events)
  const url = new URL(urlStr.endsWith('/sse') ? urlStr : `${urlStr}/sse`)
  
  const transport = new SSEClientTransport(url)
  const client = new Client({ name: 'ai-copilot-os', version: '1.0.0' }, { capabilities: {} })

  await client.connect(transport)
  
  const toolsResult = await client.listTools()
  const tools = toolsResult.tools || []

  const connection = { client, tools }
  mcpClients.set(endpoint.id, connection)
  return connection
}

export async function executeMCPTool(endpointId: string, toolName: string, args: Record<string, any>): Promise<any> {
  const connection = mcpClients.get(endpointId)
  if (!connection) throw new Error(`MCP endpoint ${endpointId} not connected`)
  
  const result = await connection.client.callTool({ name: toolName, arguments: args })
  return result
}
