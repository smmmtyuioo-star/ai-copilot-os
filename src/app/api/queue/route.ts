import { NextRequest, NextResponse } from 'next/server'
import { taskQueue, workers } from '@/lib/queue/task-queue'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const workerId = searchParams.get('workerId')
  const status = searchParams.get('status')

  if (taskId) {
    const task = taskQueue.getTask(taskId)
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json(task)
  }

  if (workerId) {
    const worker = taskQueue.getWorker(workerId)
    if (!worker) return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    return NextResponse.json(worker)
  }

  if (status) {
    const tasks = taskQueue.getTasksByStatus(status as any)
    return NextResponse.json({ tasks, count: tasks.length })
  }

  return NextResponse.json({
    tasks: taskQueue.getAllTasks().slice(0, 50),
    workers: taskQueue.getAllWorkers(),
    stats: taskQueue.getStats(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, payload, priority = 'normal', maxAttempts = 3 } = body

    if (!type) {
      return NextResponse.json({ error: 'Task type is required' }, { status: 400 })
    }

    const taskId = taskQueue.enqueue({
      type,
      payload,
      priority,
      maxAttempts,
    })

    return NextResponse.json({ taskId, status: 'queued' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to enqueue task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workerId = searchParams.get('workerId')

  if (workerId) {
    const success = taskQueue.unregisterWorker(workerId)
    return NextResponse.json({ success, message: success ? 'Worker stopped' : 'Worker not found' })
  }

  return NextResponse.json({ error: 'Worker ID required' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, workerId, heartbeat } = body

    if (taskId) {
      const task = taskQueue.getTask(taskId)
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      return NextResponse.json(task)
    }

    if (workerId && heartbeat) {
      const alive = taskQueue.workerHeartbeat(workerId)
      return NextResponse.json({ alive })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}