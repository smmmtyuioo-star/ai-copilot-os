'use client'
import { Undo2, Redo2, History } from 'lucide-react'
import { canUndo, canRedo, undo, redo, getHistory } from '@/services/undo-redo'
import { useState, useEffect } from 'react'

export default function UndoRedoToolbar() {
  const [hasUndo, setHasUndo] = useState(false)
  const [hasRedo, setHasRedo] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    function update() { setHasUndo(canUndo()); setHasRedo(canRedo()) }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  function handleUndo() {
    const entry = undo()
    if (entry) {
      setHasUndo(canUndo())
      setHasRedo(canRedo())
    }
  }

  function handleRedo() {
    const entry = redo()
    if (entry) {
      setHasUndo(canUndo())
      setHasRedo(canRedo())
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleUndo} disabled={!hasUndo}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        title="Undo last change">
        <Undo2 className="h-4 w-4" />
      </button>
      <button onClick={handleRedo} disabled={!hasRedo}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        title="Redo last undo">
        <Redo2 className="h-4 w-4" />
      </button>
      <button onClick={() => setShowHistory(!showHistory)}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="History">
        <History className="h-4 w-4" />
      </button>
      {showHistory && (
        <div className="absolute top-full right-0 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 max-h-48 overflow-y-auto">
          {getHistory().length === 0 ? (
            <div className="p-3 text-xs text-gray-400">No history</div>
          ) : (
            [...getHistory()].reverse().map((e, i) => (
              <div key={i} className="px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="font-medium">{e.description}</span>
                {e.filePath && <span className="text-gray-400 ml-1">{e.filePath}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
