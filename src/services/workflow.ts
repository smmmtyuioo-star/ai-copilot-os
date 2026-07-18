export type WorkflowStage = 'plan' | 'verify' | 'diff' | 'apply' | 'walkthrough' | 'verification'

export interface WorkflowState {
  active: boolean
  currentStage: WorkflowStage | null
  stages: Record<WorkflowStage, { status: 'pending' | 'running' | 'passed' | 'failed'; output?: string }>
  plan: { task: string; files: string[]; approach: string }
  diffs: { file: string; diff: string; verified: boolean }[]
  verification: { passed: boolean; evidence: string; issues: string[] }
}

export function createWorkflow(task: string, files: string[], approach: string): WorkflowState {
  return {
    active: true,
    currentStage: 'plan',
    stages: {
      plan: { status: 'running' },
      verify: { status: 'pending' },
      diff: { status: 'pending' },
      apply: { status: 'pending' },
      walkthrough: { status: 'pending' },
      verification: { status: 'pending' },
    },
    plan: { task, files, approach },
    diffs: [],
    verification: { passed: false, evidence: '', issues: [] },
  }
}

export function advanceStage(state: WorkflowState, to: WorkflowStage, result?: { passed?: boolean; output?: string }) {
  if (state.currentStage) {
    state.stages[state.currentStage].status = result?.passed ? 'passed' : result?.passed === false ? 'failed' : 'passed'
    if (result?.output) state.stages[state.currentStage].output = result.output
  }
  state.currentStage = to
  state.stages[to].status = 'running'
}

export function completeWorkflow(state: WorkflowState, passed: boolean, evidence: string, issues: string[] = []) {
  if (state.currentStage) {
    state.stages[state.currentStage].status = passed ? 'passed' : 'failed'
  }
  state.currentStage = null
  state.active = false
  state.stages.verification.status = passed ? 'passed' : 'failed'
  state.verification = { passed, evidence, issues }
}

export function generateDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diff: string[] = []
  diff.push(`--- a/${filePath}`)
  diff.push(`+++ b/${filePath}`)

  let i = 0
  while (i < Math.max(oldLines.length, newLines.length)) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) diff.push(`-${oldLines[i]}`)
      if (newLines[i] !== undefined) diff.push(`+${newLines[i]}`)
    } else {
      diff.push(` ${oldLines[i]}`)
    }
    i++
  }

  return diff.join('\n')
}
