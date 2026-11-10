import { useState, useEffect, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, useValue, useEditor, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { db } from '../db/db'
import { MultipleChoiceShapeUtil, type MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import { FillInTheBlankShapeUtil } from './shapes/FillInTheBlankShape'
import { RichTextShapeUtil } from './shapes/RichTextShape'
import { ExerciseEditor } from './ExerciseEditor'
import { AiBuilder } from './AiBuilder'
import type { Item } from '../types/exercise'

const BOARD_ID = 'default-board'
const customShapeUtils = [MultipleChoiceShapeUtil, FillInTheBlankShapeUtil, RichTextShapeUtil]

function BoardUI({ isTeacher, setIsTeacher }: { isTeacher: boolean, setIsTeacher: (v: boolean) => void }) {
  const editor = useEditor()
  const selectedShapes = useValue('selected', () => editor.getSelectedShapes(), [editor])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAiOpen, setIsAiOpen] = useState(false)
  
  const exerciseShape = selectedShapes.find(s => s.type === 'multiple-choice' || s.type === 'fill-in-the-blank') as MultipleChoiceShape | any | undefined

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
      try { loadSnapshot(editor.store, JSON.parse(event.target?.result as string)) } catch (err) { alert('Ошибка') }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addMultiChoice = () => {
    const center = editor.getViewportPageBounds().center
    const demoItems: Item[] = [{ id: crypto.randomUUID(), prompt: 'She ___ to school.', options: [{ id: '1', text: 'go' }, { id: '2', text: 'goes' }], answer: ['goes'] }]
    editor.createShape({ type: 'multiple-choice', x: center.x - 250, y: center.y - 250, props: { w: 500, h: 500, items: demoItems, selectedIndices: [null], confirmedIndices: [false], currentIndex: 0 } })
  }

  const addFillBlank = () => {
    const center = editor.getViewportPageBounds().center
    const demoItems: Item[] = [{ id: crypto.randomUUID(), prompt: 'She ___ to school.', answer: ['goes'] }]
    editor.createShape({ type: 'fill-in-the-blank', x: center.x - 250, y: center.y - 250, props: { w: 500, h: 300, items: demoItems, userInputs: [''], confirmedIndices: [false], currentIndex: 0 } })
  }

  const addRichText = () => {
    const center = editor.getViewportPageBounds().center
    editor.createShape({ type: 'rich-text', x: center.x - 250, y: center.y - 250, props: { w: 450, h: 300, content: '<h2>Reading Text</h2><p>Paste your text here...</p>' } })
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 8, left: isTeacher ? 340 : 16, zIndex: 1000, display: 'flex', alignItems: 'center', height: 40, gap: '8px' }}>
        <button onClick={() => setIsTeacher(!isTeacher)} style={{ padding: '0 12px', height: '100%', backgroundColor: isTeacher ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
          {isTeacher ? '👨‍🏫 Teacher Mode' : '🎓 Student Mode'}
        </button>

        {isTeacher ? (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={addMultiChoice} style={{ padding: '0 12px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Multi Choice</button>
            <button onClick={addFillBlank} style={{ padding: '0 12px', height: '100%', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Fill Blank</button>
            <button onClick={addRichText} style={{ padding: '0 12px', height: '100%', backgroundColor: '#14b8a6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Reading Text</button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => setIsAiOpen(true)} style={{ padding: '0 12px', height: '100%', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✨ AI Import</button>
            <button onClick={() => handleExport(false)} style={{ padding: '0 12px', height: '100%', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Save</button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Load</button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </>
        ) : (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => handleExport(true)} style={{ padding: '0 16px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Export My Progress</button>
          </>
        )}
      </div>
      {isTeacher && exerciseShape && <ExerciseEditor editor={editor} shape={exerciseShape} />}
      {isAiOpen && <AiBuilder editor={editor} onClose={() => setIsAiOpen(false)} />}
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
      if (board?.content) { try { loadSnapshot(editor.store, board.content) } catch (e) { console.error(e) } }
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