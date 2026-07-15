export interface FeatureConfig {
  enabled: boolean
  label: string
  description: string
  icon: string
  requiredConfig?: string[]
}

export const features: Record<string, FeatureConfig> = {
  chat: {
    enabled: true,
    label: 'Chat',
    description: 'AI-powered conversation with memory and streaming',
    icon: 'MessageSquare',
    requiredConfig: ['OPENAI_API_KEY'],
  },

  agents: {
    enabled: true,
    label: 'Agents',
    description: 'Multi-agent system for complex tasks',
    icon: 'Bot',
    requiredConfig: ['OPENAI_API_KEY'],
  },
  browser: {
    enabled: true,
    label: 'Browser Automation',
    description: 'Automated browser tasks and scraping',
    icon: 'Globe',
  },
  memory: {
    enabled: true,
    label: 'Memory',
    description: 'Short-term and long-term memory with vector search',
    icon: 'Brain',
  },
  connectors: {
    enabled: true,
    label: 'Connectors',
    description: 'Connect to external services and APIs',
    icon: 'Plug',
  },
  plugins: {
    enabled: true,
    label: 'Plugins',
    description: 'Extend functionality with plugins',
    icon: 'Puzzle',
  },
  mcp: {
    enabled: true,
    label: 'MCP',
    description: 'Model Context Protocol integration',
    icon: 'Network',
  },
  'api-center': {
    enabled: true,
    label: 'API Center',
    description: 'Manage API keys and endpoints',
    icon: 'Key',
  },
  dashboard: {
    enabled: true,
    label: 'Dashboard',
    description: 'Overview of system activity and metrics',
    icon: 'LayoutDashboard',
  },
}
