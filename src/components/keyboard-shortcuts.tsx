'use client'
import { useEffect, useCallback, useState } from 'react'

export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  label: string
  description: string
  handler: (e: KeyboardEvent) => void
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'Enter', ctrl: true, label: 'Ctrl+Enter', description: 'Send message', handler: () => {} },
  { key: 'n', ctrl: true, label: 'Ctrl+N', description: 'New chat', handler: () => {} },
  { key: 'k', ctrl: true, label: 'Ctrl+K', description: 'Focus message input', handler: () => {} },
  { key: '/', ctrl: true, label: 'Ctrl+/', description: 'Show keyboard shortcuts', handler: () => {} },
  { key: 'u', ctrl: true, label: 'Ctrl+U', description: 'Toggle sidebar', handler: () => {} },
  { key: 'Escape', label: 'Escape', description: 'Close sidebar or cancel edit', handler: () => {} },
  { key: 'l', ctrl: true, label: 'Ctrl+L', description: 'Clear current chat', handler: () => {} },
  { key: ']', ctrl: true, shift: true, label: 'Ctrl+Shift+]', description: 'Next conversation', handler: () => {} },
  { key: '[', ctrl: true, shift: true, label: 'Ctrl+Shift+[', description: 'Previous conversation', handler: () => {} },
]

export function useShortcuts(
  shortcuts: Shortcut[],
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return
    function handler(e: KeyboardEvent) {
      for (const s of shortcuts) {
        const ctrl = e.ctrlKey || e.metaKey
        const shift = e.shiftKey
        const alt = e.altKey
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          (s.ctrl === undefined || s.ctrl === ctrl) &&
          (s.shift === undefined || s.shift === shift) &&
          (s.alt === undefined || s.alt === alt)
        ) {
          if (s.ctrl || s.alt || s.meta) {
            e.preventDefault()
            e.stopPropagation()
          }
          s.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}

export function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-2">
          {DEFAULT_SHORTCUTS.map(s => (
            <div key={s.label} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
              <kbd className="rounded-md border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-mono dark:border-gray-600 dark:bg-gray-800">{s.label}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
