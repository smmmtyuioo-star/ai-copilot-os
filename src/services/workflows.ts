import { getSupabase } from '@/database/client'
import type { Workflow, WorkflowNode, WorkflowTrigger } from '@/types'
import { generateId, parseError } from '@/lib/utils'

function getClient() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase client not available. Check your environment variables.')
  return c
}

export async function createWorkflow(
  userId: string,
  name: string,
  description: string,
  nodes: WorkflowNode[],
  triggers: WorkflowTrigger[],
): Promise<Workflow> {
  const supabase = getClient()
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
  const { error } = await supabase.from('workflows').insert(workflow)
  if (error) throw new Error(error.message)
  return workflow
}

export async function getWorkflows(userId: string): Promise<Workflow[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase
    .from('workflows')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteWorkflow(id: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.from('workflows').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function executeWorkflow(workflowId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getClient()
    const { data: workflow } = await supabase
      .from('workflows').select('*').eq('id', workflowId).single()
    if (!workflow) return { success: false, error: 'Workflow not found' }

    await supabase.from('workflow_executions').insert({
      id: generateId(),
      workflow_id: workflowId,
      status: 'running',
      started_at: new Date().toISOString(),
    })

    await updateWorkflow(workflowId, { status: 'active' })
    return { success: true }
  } catch (err) {
    return { success: false, error: parseError(err) }
  }
}
