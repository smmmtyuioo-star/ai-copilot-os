import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { provider, action, params, credentials } = await request.json()

    if (!provider || !action || !credentials) {
      return NextResponse.json({ error: 'Provider, action, and credentials are required' }, { status: 400 })
    }

    if (provider === 'github') {
      const token = credentials.token || credentials.apiKey
      if (!token) return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 })

      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'AI-Copilot-OS' }

      switch (action) {
        case 'list-repos': {
          const res = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return NextResponse.json({ error: `GitHub API: ${res.status}` }, { status: res.status })
          const repos = await res.json()
          return NextResponse.json({ success: true, data: repos.map((r: any) => ({ name: r.name, full_name: r.full_name, description: r.description, url: r.html_url, private: r.private, language: r.language, updated_at: r.updated_at })) })
        }

        case 'list-org-repos': {
          const org = params?.org || (await (await fetch('https://api.github.com/user', { headers })).json()).login
          const res = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=50`, { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return NextResponse.json({ error: `GitHub API: ${res.status}` }, { status: res.status })
          const repos = await res.json()
          return NextResponse.json({ success: true, data: repos.map((r: any) => ({ name: r.name, full_name: r.full_name, description: r.description, url: r.html_url, private: r.private, language: r.language })) })
        }

        case 'create-repo': {
          if (!params?.name) return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
          const res = await fetch('https://api.github.com/user/repos', {
            method: 'POST', headers, body: JSON.stringify({
              name: params.name, description: params.description || '', private: params.private || false, auto_init: true,
            }), signal: AbortSignal.timeout(15000),
          })
          if (!res.ok) return NextResponse.json({ error: `GitHub API: ${res.status} ${res.statusText}` }, { status: res.status })
          const repo = await res.json()
          return NextResponse.json({ success: true, data: { name: repo.name, full_name: repo.full_name, url: repo.html_url, clone_url: repo.clone_url } })
        }

        case 'get-repo': {
          if (!params?.repo) return NextResponse.json({ error: 'Repository (owner/repo) is required' }, { status: 400 })
          const res = await fetch(`https://api.github.com/repos/${params.repo}`, { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return NextResponse.json({ error: `GitHub API: ${res.status}` }, { status: res.status })
          const repo = await res.json()
          return NextResponse.json({ success: true, data: { name: repo.name, full_name: repo.full_name, description: repo.description, url: repo.html_url, language: repo.language, stars: repo.stargazers_count, forks: repo.forks_count, open_issues: repo.open_issues_count } })
        }

        case 'create-file': {
          if (!params?.repo || !params?.path || !params?.content) return NextResponse.json({ error: 'Repo, path, and content are required' }, { status: 400 })
          // Get default branch
          const repoRes = await fetch(`https://api.github.com/repos/${params.repo}`, { headers })
          if (!repoRes.ok) return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
          const repoData = await repoRes.json()
          const branch = repoData.default_branch

          // Get latest commit SHA
          const refRes = await fetch(`https://api.github.com/repos/${params.repo}/git/refs/heads/${branch}`, { headers })
          if (!refRes.ok) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
          const refData = await refRes.json()
          const latestSha = refData.object.sha

          // Create blob
          const blobRes = await fetch(`https://api.github.com/repos/${params.repo}/git/blobs`, {
            method: 'POST', headers, body: JSON.stringify({ content: params.content, encoding: 'utf-8' }),
          })
          if (!blobRes.ok) return NextResponse.json({ error: 'Failed to create blob' }, { status: 500 })
          const blobData = await blobRes.json()

          // Create tree
          const treeRes = await fetch(`https://api.github.com/repos/${params.repo}/git/trees`, {
            method: 'POST', headers, body: JSON.stringify({
              base_tree: latestSha, tree: [{ path: params.path, mode: '100644', type: 'blob', sha: blobData.sha }],
            }),
          })
          if (!treeRes.ok) return NextResponse.json({ error: 'Failed to create tree' }, { status: 500 })
          const treeData = await treeRes.json()

          // Create commit
          const commitRes = await fetch(`https://api.github.com/repos/${params.repo}/git/commits`, {
            method: 'POST', headers, body: JSON.stringify({
              message: params.message || `Create ${params.path}`, tree: treeData.sha, parents: [latestSha],
            }),
          })
          if (!commitRes.ok) return NextResponse.json({ error: 'Failed to create commit' }, { status: 500 })
          const commitData = await commitRes.json()

          // Update ref
          await fetch(`https://api.github.com/repos/${params.repo}/git/refs/heads/${branch}`, {
            method: 'PATCH', headers, body: JSON.stringify({ sha: commitData.sha }),
          })

          return NextResponse.json({ success: true, data: { commit: commitData.sha, message: params.message || `Create ${params.path}`, url: `https://github.com/${params.repo}/commit/${commitData.sha}` } })
        }

        case 'user-info': {
          const res = await fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return NextResponse.json({ error: `GitHub API: ${res.status}` }, { status: res.status })
          const user = await res.json()
          return NextResponse.json({ success: true, data: { login: user.login, name: user.name, email: user.email, public_repos: user.public_repos, followers: user.followers, avatar: user.avatar_url } })
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}. Supported: list-repos, create-repo, get-repo, create-file, user-info, list-org-repos` }, { status: 400 })
      }
    }

    return NextResponse.json({ error: `Provider '${provider}' not supported yet. Try: github.` }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
