import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Tool as MCPToolDef } from '@modelcontextprotocol/sdk/types.js'

export interface MCPEndpoint {
  id: string
  name: string
  url: string
  protocol: string
}

export interface MCPConnectionResult {
  success: boolean
  client?: Client
  tools?: MCPToolDef[]
  error?: string
}

export interface MCPToolResult {
  success: boolean
  data?: any
  error?: string
}

const mcpClients = new Map<string, { client: Client; tools: MCPToolDef[] }>()

export async function connectMCPEndpoint(endpoint: MCPEndpoint): Promise<MCPConnectionResult> {
  const existing = mcpClients.get(endpoint.id)
  if (existing) return { success: true, client: existing.client, tools: existing.tools }

  try {
    const urlStr = `${endpoint.protocol}://${endpoint.url}`
    const url = new URL(urlStr.endsWith('/sse') ? urlStr : `${urlStr}/sse`)

    const transport = new SSEClientTransport(url)
    const client = new Client({ name: 'ai-copilot-os', version: '1.0.0' }, { capabilities: {} })

    await client.connect(transport)

    const toolsResult = await client.listTools()
    const tools = toolsResult.tools || []

    const connection = { client, tools }
    mcpClients.set(endpoint.id, connection)
    return { success: true, client, tools }
  } catch (err) {
    console.error(`MCP connect failed for ${endpoint.name} (${endpoint.url}):`, err)
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function executeMCPTool(endpointId: string, toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
  try {
    const connection = mcpClients.get(endpointId)
    if (!connection) return { success: false, error: `MCP endpoint ${endpointId} not connected` }

    const result = await connection.client.callTool({ name: toolName, arguments: args })
    return { success: true, data: result }
  } catch (err) {
    console.error(`MCP tool ${toolName} execution on ${endpointId} failed:`, err)
    return { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' }
  }
}
