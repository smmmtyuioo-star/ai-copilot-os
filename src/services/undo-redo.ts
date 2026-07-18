export interface UndoEntry {
  id: string
  timestamp: number
  description: string
  filePath?: string
  oldContent?: string
  newContent?: string
  type: 'edit' | 'delete' | 'create' | 'shell'
}

const STORAGE_KEY = 'ac_undo_stack'
const MAX_STACK = 50

let undoStack: UndoEntry[] = []
let redoStack: UndoEntry[] = []

export function loadHistory() {
  if (typeof window === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    undoStack = saved
    redoStack = []
  } catch { undoStack = []; redoStack = [] }
}

function saveHistory() {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(undoStack.slice(-MAX_STACK)))
}

export function pushUndo(entry: UndoEntry) {
  undoStack.push(entry)
  redoStack = []
  saveHistory()
}

export function undo(): UndoEntry | null {
  const entry = undoStack.pop()
  if (entry) {
    redoStack.push(entry)
    saveHistory()
  }
  return entry || null
}

export function redo(): UndoEntry | null {
  const entry = redoStack.pop()
  if (entry) {
    undoStack.push(entry)
    saveHistory()
  }
  return entry || null
}

export function getHistory() {
  return [...undoStack]
}

export function getRedoStack() {
  return [...redoStack]
}

export function clearHistory() {
  undoStack = []
  redoStack = []
  saveHistory()
}

export function canUndo() { return undoStack.length > 0 }
export function canRedo() { return redoStack.length > 0 }
