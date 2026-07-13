import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from '@/lib/storage'
import type { Workflow, WorkflowNode, WorkflowTrigger } from '@/types'
import { generateId, parseError } from '@/lib/utils'

export async function createWorkflow(
  userId: string,
  name: string,
  description: string,
  nodes: WorkflowNode[],
  triggers: WorkflowTrigger[],
): Promise<Workflow> {
  const workflow: Workflow = {
    id: generateId(),
    user_id: userId,
    name,
    description,
    nodes,
    triggers,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('workflows').insert(workflow)
      if (error) throw new Error(error.message)
      return workflow
    }
  }
  localStore.workflows.add({ id: workflow.id, name, description, status: 'draft', nodes: JSON.stringify(nodes), triggers: JSON.stringify(triggers), createdAt: workflow.created_at, updatedAt: workflow.updated_at })
  return workflow
}

export async function getWorkflows(userId: string): Promise<Workflow[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('workflows').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      if (!error && data) return data
    }
  }
  return localStore.workflows.items.map(w => ({
    id: w.id, user_id: userId, name: w.name, description: w.description,
    nodes: JSON.parse(w.nodes || '[]'), triggers: JSON.parse(w.triggers || '[]'),
    status: w.status as Workflow['status'], created_at: w.createdAt, updated_at: w.updatedAt,
  }))
}

export async function updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      await supabase.from('workflows').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
      return
    }
  }
  localStore.workflows.update(id, { ...updates, updatedAt: new Date().toISOString() } as any)
}

export async function deleteWorkflow(id: string): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) { await supabase.from('workflows').delete().eq('id', id); return }
  }
  localStore.workflows.remove(id)
}

export async function executeWorkflow(workflowId: string): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    let workflow: Workflow | undefined
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase.from('workflows').select('*').eq('id', workflowId).single()
        workflow = data || undefined
      }
    }
    if (!workflow) {
      const w = localStore.workflows.getById(workflowId)
      if (!w) return { success: false, error: 'Workflow not found' }
      workflow = { id: w.id, user_id: 'local', name: w.name, description: w.description, nodes: JSON.parse(w.nodes || '[]'), triggers: JSON.parse(w.triggers || '[]'), status: w.status as Workflow['status'], created_at: w.createdAt, updated_at: w.updatedAt }
    }

    updateWorkflow(workflowId, { status: 'active' })

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `You are executing a workflow named "${workflow.name}". Description: "${workflow.description}". Execute the workflow logic and provide the result. Be thorough and detailed.` },
          { role: 'user', content: `Execute workflow with ${workflow.nodes.length} steps. Nodes: ${JSON.stringify(workflow.nodes)}. Triggers: ${JSON.stringify(workflow.triggers)}` },
        ],
      }),
    })

    let output = ''
    if (response.ok && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { const parsed = JSON.parse(data); output += parsed.choices?.[0]?.delta?.content || '' } catch {}
        }
      }
    }

    return { success: true, output }
  } catch (err) {
    return { success: false, error: parseError(err) }
  }
}
