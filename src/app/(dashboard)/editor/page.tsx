'use client'
import { EditorShell } from '@/components/editor-shell'

export default function EditorPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editor</h1>
        <p className="text-sm text-gray-500">File tree, tabs, and terminal — editor-native environment</p>
      </div>
      <div className="flex-1">
        <EditorShell />
      </div>
    </div>
  )
}
