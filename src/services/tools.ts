export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  items?: { type: string }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameterProperty>
    required: string[]
  }
}

export type ToolSafety = 'read' | 'write'

export interface ToolRegistryEntry {
  definition: ToolDefinition
  safety: ToolSafety
}

export function isWriteTool(toolName: string): boolean {
  return TOOL_REGISTRY[toolName]?.safety === 'write'
}

export function getWriteTools(): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([, entry]) => entry.safety === 'write')
    .map(([name]) => name)
}

export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  web_search: {
    safety: 'read',
    definition: {
      name: 'web_search',
      description: 'Search the web for current information, news, documentation, or any real-time data. Uses Tavily search engine.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string' },
          max_results: { type: 'number', description: 'Maximum number of results to return (1-10, default 5)' },
        },
        required: ['query'],
      },
    },
  },
  fetch_url: {
    safety: 'read',
    definition: {
      name: 'fetch_url',
      description: 'Fetch and extract readable text content from a URL. Strips HTML and returns plain text (max 10K chars).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch (including https://)' },
        },
        required: ['url'],
      },
    },
  },
  github_action: {
    safety: 'write',
    definition: {
      name: 'github_action',
      description: 'Execute GitHub API operations — list repos, get repo details, create repo, create file, get user info.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The GitHub action to perform',
            enum: ['list-repos', 'get-repo', 'list-org-repos', 'create-repo', 'create-file', 'user-info'],
          },
          owner: { type: 'string', description: 'Repository owner (user or org name)' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File path (for create-file action)' },
          content: { type: 'string', description: 'File content (for create-file action)' },
          message: { type: 'string', description: 'Commit message (for create-file action)' },
          name: { type: 'string', description: 'Repository name (for create-repo action)' },
          description: { type: 'string', description: 'Repository description' },
          private: { type: 'boolean', description: 'Whether the repo should be private' },
        },
        required: ['action'],
      },
    },
  },
  safe_browsing_check: {
    safety: 'read',
    definition: {
      name: 'safe_browsing_check',
      description: 'Check if a URL is safe by scanning against Google Safe Browsing threat lists (malware, phishing, unwanted software).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to check' },
        },
        required: ['url'],
      },
    },
  },
  execute_code: {
    safety: 'write',
    definition: {
      name: 'execute_code',
      description: 'Execute JavaScript code in a sandboxed environment. Use this to run code, test algorithms, process data, or generate outputs. No network or file system access.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The JavaScript code to execute' },
          timeout: { type: 'number', description: 'Execution timeout in milliseconds (max 30000, default 5000)' },
        },
        required: ['code'],
      },
    },
  },
  search_memory: {
    safety: 'read',
    definition: {
      name: 'search_memory',
      description: 'Search through stored user memories and past conversation history for relevant context about the user, their projects, preferences, and past decisions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to find relevant memories' },
          type: { type: 'string', enum: ['short-term', 'long-term'], description: 'Filter by memory type (optional)' },
        },
        required: ['query'],
      },
    },
  },
  shell: {
    safety: 'write',
    definition: {
      name: 'shell',
      description: 'Execute arbitrary OS commands in a sandboxed shell. Use this to compile code, run tests, manage files, or interact with the system.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          workdir: { type: 'string', description: 'Working directory for the command (optional)' },
        },
        required: ['command'],
      },
    },
  },
  edit: {
    safety: 'write',
    definition: {
      name: 'edit',
      description: 'Edit a file using search-and-replace style patches. Use this to modify existing files.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file' },
          oldString: { type: 'string', description: 'The exact string to replace' },
          newString: { type: 'string', description: 'The new string to insert' },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
    },
  },
  write: {
    safety: 'write',
    definition: {
      name: 'write',
      description: 'Write a full file to disk, overwriting it entirely if it exists. Use this for new files or complete rewrites.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'The full file content' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  preview: {
    safety: 'write',
    definition: {
      name: 'preview',
      description: 'Start a live preview development server for a project. Returns the URL where the preview is running.',
      parameters: {
        type: 'object',
        properties: {
          workdir: { type: 'string', description: 'Working directory to start the server in' },
          command: { type: 'string', description: 'Command to run (e.g. "npm run dev")' },
        },
        required: ['workdir', 'command'],
      },
    },
  },
}

export function getToolDefinitions(toolNames?: string[]): { type: 'function'; function: ToolDefinition }[] {
  const names = toolNames || Object.keys(TOOL_REGISTRY)
  return names
    .filter(name => TOOL_REGISTRY[name])
    .map(name => ({
      type: 'function' as const,
      function: TOOL_REGISTRY[name].definition,
    }))
}

export type ToolName = keyof typeof TOOL_REGISTRY

export interface ToolExecutionContext {
  userId: string
}

type ToolHandler = (args: Record<string, any>, context: ToolExecutionContext) => Promise<string>

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  web_search: async (args) => {
    const query = String(args.query || '')
    const maxResults = Math.min(Math.max(Number(args.max_results) || 5, 1), 10)
    if (!query) return 'Error: query is required'

    try {
      const { env } = await import('@/config/env')
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.tavilyKey}` },
        body: JSON.stringify({ query, search_depth: 'advanced', max_results: maxResults, include_answer: true }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) return `Search failed: HTTP ${response.status}`
      const data = await response.json()
      let result = ''
      if (data.answer) result += `Answer: ${data.answer}\n\n`
      if (data.results?.length) {
        result += 'Results:\n'
        data.results.forEach((r: any, i: number) => {
          result += `${i + 1}. ${r.title}\n   ${r.content}\n   URL: ${r.url}\n\n`
        })
      }
      return result.trim() || 'No results found.'
    } catch (err) {
      return `Search error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  fetch_url: async (args) => {
    const url = String(args.url || '')
    if (!url) return 'Error: url is required'

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) return `Failed to fetch URL: HTTP ${response.status}`
      const html = await response.text()
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const maxChars = 10000
      return text.length > maxChars ? text.slice(0, maxChars) + `\n\n... [truncated at ${maxChars} chars]` : text
    } catch (err) {
      return `Fetch error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  github_action: async (args) => {
    const action = String(args.action || '')
    if (!action) return 'Error: action is required'

    try {
      const token = String(args.token || '')
      if (!token) return 'Error: GitHub token is required — ask the user to provide one'

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Copilot-OS',
      }

      switch (action) {
        case 'list-repos': {
          const res = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return `GitHub API error: ${res.status}`
          const repos = await res.json()
          return repos.map((r: any) => `- ${r.full_name}${r.description ? `: ${r.description}` : ''} [${r.language || '?'}] ${r.private ? '(private)' : '(public)'}`).join('\n')
        }

        case 'get-repo': {
          const repo = String(args.repo || '')
          if (!repo) return 'Error: repo is required (format: owner/repo)'
          const res = await fetch(`https://api.github.com/repos/${repo}`, { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return `GitHub API error: ${res.status}`
          const data = await res.json()
          return `Name: ${data.full_name}\nDescription: ${data.description || 'N/A'}\nLanguage: ${data.language || 'N/A'}\nStars: ${data.stargazers_count}\nForks: ${data.forks_count}\nOpen Issues: ${data.open_issues_count}\nURL: ${data.html_url}`
        }

        case 'list-org-repos': {
          const org = String(args.owner || '')
          if (!org) return 'Error: owner (org name) is required'
          const res = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=50`, { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return `GitHub API error: ${res.status}`
          const repos = await res.json()
          return repos.map((r: any) => `- ${r.full_name}${r.description ? `: ${r.description}` : ''} [${r.language || '?'}]`).join('\n')
        }

        case 'create-repo': {
          const name = String(args.name || '')
          if (!name) return 'Error: name is required'
          const res = await fetch('https://api.github.com/user/repos', {
            method: 'POST', headers,
            body: JSON.stringify({ name, description: String(args.description || ''), private: !!args.private, auto_init: true }),
            signal: AbortSignal.timeout(15000),
          })
          if (!res.ok) return `GitHub API error: ${res.status}`
          const data = await res.json()
          return `Created: ${data.full_name}\nURL: ${data.html_url}\nClone: ${data.clone_url}`
        }

        case 'create-file': {
          const repo = String(args.repo || '')
          const path = String(args.path || '')
          const content = String(args.content || '')
          if (!repo || !path || !content) return 'Error: repo, path, and content are required'

          const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers })
          if (!repoRes.ok) return 'Repo not found'
          const repoData = await repoRes.json()
          const branch = repoData.default_branch

          const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { headers })
          if (!refRes.ok) return 'Branch not found'
          const refData = await refRes.json()
          const latestSha = refData.object.sha

          const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
            method: 'POST', headers, body: JSON.stringify({ content, encoding: 'utf-8' }),
          })
          if (!blobRes.ok) return 'Failed to create blob'
          const blobData = await blobRes.json()

          const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
            method: 'POST', headers,
            body: JSON.stringify({ base_tree: latestSha, tree: [{ path, mode: '100644', type: 'blob', sha: blobData.sha }] }),
          })
          if (!treeRes.ok) return 'Failed to create tree'
          const treeData = await treeRes.json()

          const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
            method: 'POST', headers,
            body: JSON.stringify({ message: String(args.message || `Create ${path}`), tree: treeData.sha, parents: [latestSha] }),
          })
          if (!commitRes.ok) return 'Failed to create commit'
          const commitData = await commitRes.json()

          await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
            method: 'PATCH', headers, body: JSON.stringify({ sha: commitData.sha }),
          })

          return `File created: ${repo}/${path}\nCommit: ${commitData.sha}\nURL: https://github.com/${repo}/commit/${commitData.sha}`
        }

        case 'user-info': {
          const res = await fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return `GitHub API error: ${res.status}`
          const user = await res.json()
          return `Login: ${user.login}\nName: ${user.name || 'N/A'}\nEmail: ${user.email || 'N/A'}\nPublic repos: ${user.public_repos}\nFollowers: ${user.followers}`
        }

        default:
          return `Unknown action: ${action}. Supported: list-repos, get-repo, list-org-repos, create-repo, create-file, user-info`
      }
    } catch (err) {
      return `GitHub action error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  safe_browsing_check: async (args) => {
    const url = String(args.url || '')
    if (!url) return 'Error: url is required'

    try {
      const { env } = await import('@/config/env')
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.ai.googleSafeBrowsingKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'ai-copilot-os', clientVersion: '1.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url }],
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!response.ok) return `Safe Browsing check failed: HTTP ${response.status}`
      const data = await response.json()
      const threats = data.matches || []
      if (threats.length === 0) return 'SAFE: No threats detected for this URL.'
      return `UNSAFE: ${threats.map((t: any) => `${t.threatType} (${t.platformType})`).join(', ')}`
    } catch (err) {
      return `Safe Browsing error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  search_memory: async (args, context) => {
    const query = String(args.query || '')
    if (!query) return 'Error: query is required'

    try {
      const { searchMemory } = await import('@/services/memory')
      const type = args.type as 'short-term' | 'long-term' | undefined
      const results = await searchMemory(context.userId, query, type)
      if (results.length === 0) return 'No memories found matching that query.'
      return results.map((m, i) =>
        `[${i + 1}] (${m.type}) ${m.content}\n   ${new Date(m.created_at).toLocaleDateString()}`
      ).join('\n\n')
    } catch (err) {
      return `Memory search error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  execute_code: async (args) => {
    const code = String(args.code || '')
    if (!code) return 'Error: code is required'

    try {
      const { executeCode } = await import('@/services/code-execution')
      const result = await executeCode({ code, language: 'javascript', timeout: Number(args.timeout) || 5000 })
      let output = ''
      if (result.stdout) output += `Output:\n${result.stdout}\n`
      if (result.stderr) output += `Errors:\n${result.stderr}\n`
      if (result.error) output += `Error: ${result.error}`
      if (!output) output = '(no output)'
      output += `\n\nCompleted in ${result.executionTimeMs}ms`
      return output
    } catch (err) {
      return `Code execution error: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  },

  shell: async (args) => {
    const command = String(args.command || '')
    if (!command) return 'Error: command is required'
    const workdir = args.workdir ? String(args.workdir) : process.cwd()

    try {
      const { evaluateCommand } = await import('@/lib/command-guard/src/engine')
      const guardResult = evaluateCommand(command)
      if (!guardResult.allowed) {
        return `Error: Command blocked by safety rules (Severity: ${guardResult.severity}). Reason: ${guardResult.matches[0]?.reason}`
      }
      
      const { exec } = await import('child_process')
      const util = await import('util')
      const execPromise = util.promisify(exec)
      
      const { stdout, stderr } = await execPromise(command, { cwd: workdir, timeout: 120000 })
      let output = ''
      if (stdout) output += `Stdout:\n${stdout}\n`
      if (stderr) output += `Stderr:\n${stderr}\n`
      
      const maxChars = 20000
      const { safeTruncateOutput } = await import('@/lib/truncate')
      output = await safeTruncateOutput(output, maxChars, 'shell_output')
      
      return output.trim() || '(no output)'
    } catch (err: any) {
      return `Shell error: ${err.message || 'Unknown error'}\n${err.stdout ? `Stdout: ${err.stdout}\n` : ''}${err.stderr ? `Stderr: ${err.stderr}` : ''}`
    }
  },

  edit: async (args) => {
    const filePath = String(args.filePath || '')
    const oldString = String(args.oldString || '')
    const newString = String(args.newString || '')
    if (!filePath || !oldString || newString === undefined) return 'Error: filePath, oldString, and newString are required'
    if (oldString === newString) return 'Error: oldString and newString are identical'

    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf8')
      if (!content.includes(oldString)) {
        return 'Error: Could not find oldString in the file. It must match exactly.'
      }
      // Simple exact match replace (first occurrence)
      const newContent = content.replace(oldString, newString)
      await fs.writeFile(filePath, newContent, 'utf8')
      return `Edit applied successfully to ${filePath}.`
    } catch (err: any) {
      return `Edit error: ${err.message}`
    }
  },

  write: async (args) => {
    const filePath = String(args.filePath || '')
    const content = String(args.content || '')
    if (!filePath || content === undefined) return 'Error: filePath and content are required'

    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf8')
      return `File written successfully to ${filePath}.`
    } catch (err: any) {
      return `Write error: ${err.message}`
    }
  },

  preview: async (args, context) => {
    const workdir = String(args.workdir || '')
    const command = String(args.command || 'npm run dev')
    if (!workdir) return 'Error: workdir is required'

    try {
      const { startPreviewServer } = await import('@/services/preview-server')
      const id = context?.userId || 'anonymous_preview'
      const { url, port } = await startPreviewServer(id, workdir, command)
      return `Preview server started successfully at ${url} (Port ${port}). Provide this URL to the user to view the app.`
    } catch (err: any) {
      return `Preview error: ${err.message}`
    }
  },
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> {
  const handler = TOOL_HANDLERS[name]
  if (!handler) return `Error: Unknown tool "${name}". Available: ${Object.keys(TOOL_HANDLERS).join(', ')}`
  try {
    return await handler(args, context)
  } catch (err) {
    return `Tool execution error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}
