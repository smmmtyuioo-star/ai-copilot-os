'use client'
import { CheckCircle2, Loader2, XCircle, AlertCircle } from 'lucide-react'
import type { WorkflowState, WorkflowStage } from '@/services/workflow'

const STAGE_LABELS: Record<WorkflowStage, string> = {
  plan: 'Planning',
  verify: 'Verifying',
  diff: 'Diff',
  apply: 'Applying',
  walkthrough: 'Walkthrough',
  verification: 'Verification',
}

const STAGE_ORDER: WorkflowStage[] = ['plan', 'verify', 'diff', 'apply', 'walkthrough', 'verification']

export default function WorkflowBar({ workflow }: { workflow: WorkflowState | null }) {
  if (!workflow || !workflow.active) return null

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500">Workflow</span>
        <span className="text-xs text-gray-400">{workflow.plan.task.slice(0, 60)}</span>
      </div>
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stage, i) => {
          const s = workflow.stages[stage]
          const isCurrent = workflow.currentStage === stage
          const isDone = s.status === 'passed' || s.status === 'failed'
          return (
            <div key={stage} className="flex items-center gap-1">
              {i > 0 && <div className={`h-px w-3 ${isDone ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`} />}
              <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                isCurrent ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' :
                s.status === 'passed' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200' :
                s.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' :
                'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {s.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 s.status === 'passed' ? <CheckCircle2 className="h-3 w-3" /> :
                 s.status === 'failed' ? <XCircle className="h-3 w-3" /> :
                 <AlertCircle className="h-3 w-3" />}
                <span>{STAGE_LABELS[stage]}</span>
              </div>
            </div>
          )
        })}
      </div>
      {workflow.stages.verify.output && (
        <div className="mt-1 text-xs text-gray-500">{workflow.stages.verify.output}</div>
      )}
    </div>
  )
}
