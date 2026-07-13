'use client'
import { useState, useEffect } from 'react'
import { Plus, Play, Pause, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getWorkflows, createWorkflow, deleteWorkflow, executeWorkflow } from '@/services/workflows'
import type { Workflow } from '@/types'
import { formatDate } from '@/lib/utils'

export default function WorkflowsPage() {
  const { user } = useAuth()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const data = await getWorkflows(user.id)
    setWorkflows(data)
  }

  async function handleCreate() {
    if (!user || !name.trim()) return
    await createWorkflow(user.id, name, desc, [], [])
    setShowCreate(false)
    setName('')
    setDesc('')
    load()
  }

  async function handleDelete(id: string) {
    await deleteWorkflow(id)
    load()
  }

  async function handleExecute(id: string) {
    const result = await executeWorkflow(id)
    if (!result.success && result.error) {
      alert(result.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflows</h1>
          <p className="text-sm text-gray-500">Automate multi-step processes</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Workflow</Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No workflows yet. Create your first automation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map(wf => (
            <Card key={wf.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{wf.name}</CardTitle>
                  <Badge variant={wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'default' : 'warning'}>
                    {wf.status}
                  </Badge>
                </div>
                {wf.description && <CardDescription>{wf.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-gray-500">Created {formatDate(wf.created_at)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleExecute(wf.id)}>
                    <Play className="h-4 w-4" /> Run
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(wf.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workflow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="My Workflow" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" rows={3} placeholder="What does this workflow do?" />
          </div>
          <Button onClick={handleCreate} className="w-full">Create</Button>
        </div>
      </Modal>
    </div>
  )
}
