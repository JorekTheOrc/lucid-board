import { useState, useEffect, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, useValue, useEditor, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { db } from '../db/db'
import { MultipleChoiceShapeUtil, type MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import { ExerciseEditor } from './ExerciseEditor'
import type { Item } from '../types/exercise'

const BOARD_ID = 'default-board'
const customShapeUtils = [MultipleChoiceShapeUtil]

function BoardUI({ isTeacher, setIsTeacher }: { isTeacher: boolean, setIsTeacher: (v: boolean) => void }) {
  const editor = useEditor()
  const selectedShapes = useValue('selected', () => editor.getSelectedShapes(), [editor])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const mcShape = selectedShapes.find(s => s.type === 'multiple-choice') as MultipleChoiceShape | undefined

  // ИСПРАВЛЕНО: isReadonly вместо isReadOnly
  useEffect(() => {
    editor.updateInstanceState({ isReadonly: !isTeacher })
  }, [editor, isTeacher])

  const handleExport = (isProgress = false) => {
    const snapshot = getSnapshot(editor.store)
    const dataStr = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = isProgress ? `progress-${Date.now()}.json` : `lucid-board-template.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const snapshot = JSON.parse(event.target?.result as string)
        loadSnapshot(editor.store, snapshot)
      } catch (err) { alert('Ошибка: неверный формат файла') }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 8, left: isTeacher ? 340 : 16, zIndex: 1000, display: 'flex', alignItems: 'center', height: 40, gap: '8px' }}>
        
        <button
          onClick={() => setIsTeacher(!isTeacher)}
          style={{
            padding: '0 12px', height: '100%', backgroundColor: isTeacher ? '#f59e0b' : '#3b82f6',
            color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold',
            cursor: 'pointer', fontSize: '12px',
          }}
        >
          {isTeacher ? '👨‍🏫 Teacher Mode' : '🎓 Student Mode'}
        </button>

        {isTeacher ? (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button
              onClick={() => {
                const center = editor.getViewportPageBounds().center
                const newItem: Item = { id: crypto.randomUUID(), prompt: 'New Question', options: [{ id: crypto.randomUUID(), text: 'Option 1' }, { id: crypto.randomUUID(), text: 'Option 2' }], answer: ['Option 1'] }
                editor.createShape({ type: 'multiple-choice', x: center.x - 200, y: center.y - 125, props: { w: 400, h: 250, item: newItem, selectedIndex: null } })
              }}
              style={{ padding: '0 16px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
            >
              + Add Exercise
            </button>
            <button onClick={() => handleExport(false)} style={{ padding: '0 12px', height: '100%', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Save Template</button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Load Template</button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </>
        ) : (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => handleExport(true)} style={{ padding: '0 16px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Export My Progress</button>
          </>
        )}
      </div>

      {isTeacher && mcShape && <ExerciseEditor editor={editor} shape={mcShape} />}
    </>
  )
}

export function Board() {
  const [isTeacher, setIsTeacher] = useState(true)
  const saveTimer = useRef<number | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const handleMount = (editor: Editor) => {
    editorRef.current = editor
    db.boards.get(BOARD_ID).then((board) => {
      if (board?.content) {
        try { loadSnapshot(editor.store, board.content) } catch (e) { console.error(e) }
      }
    })

    editor.store.listen(() => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(async () => {
          try {
            const snapshot = getSnapshot(editor.store)
            const now = Date.now()
            const existing = await db.boards.get(BOARD_ID)
            await db.boards.put({ id: BOARD_ID, title: existing?.title ?? 'Untitled', course: existing?.course ?? 'General', createdAt: existing?.createdAt ?? now, updatedAt: now, content: snapshot })
          } catch (e) { console.error(e) }
        }, 800)
      }, { scope: 'document' })
  }

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }, [])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} hideUi={!isTeacher}>
        <BoardUI isTeacher={isTeacher} setIsTeacher={setIsTeacher} />
      </Tldraw>
    </div>
  )
}