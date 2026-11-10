import { useEffect, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, useValue, useEditor, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { db } from '../db/db'
import { MultipleChoiceShapeUtil, type MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import { ExerciseEditor } from './ExerciseEditor'
import type { Item } from '../types/exercise'

const BOARD_ID = 'default-board'
const customShapeUtils = [MultipleChoiceShapeUtil]

// BoardUI рендерится внутри <Tldraw>, поэтому useEditor() безопасен
function BoardUI() {
  const editor = useEditor()
  const selectedShapes = useValue('selected', () => editor.getSelectedShapes(), [editor])
  
  const mcShape = selectedShapes.find(s => s.type === 'multiple-choice') as MultipleChoiceShape | undefined

  return (
    <>
      <div style={{ 
        position: 'absolute', 
        top: 8, 
        left: 340, 
        zIndex: 1000, 
        display: 'flex', 
        alignItems: 'center',
        height: 40,
        gap: '8px'
      }}>
        <button
          onClick={() => {
            const center = editor.getViewportPageBounds().center
            const newItem: Item = {
              id: crypto.randomUUID(),
              prompt: 'New Question',
              options: [
                { id: crypto.randomUUID(), text: 'Option 1' },
                { id: crypto.randomUUID(), text: 'Option 2' }
              ],
              answer: ['Option 1'],
            }
            editor.createShape({
              type: 'multiple-choice',
              x: center.x - 200,
              y: center.y - 125,
              props: { w: 400, h: 250, item: newItem, selectedIndex: null },
            })
          }}
          style={{
            padding: '0 16px',
            height: '100%',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Exercise
        </button>
        <button
          onClick={async () => {
            if (confirm('Очистить базу данных?')) {
              await db.boards.clear();
              window.location.reload();
            }
          }}
          style={{
            padding: '0 12px',
            height: '100%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Clear DB
        </button>
      </div>

      {mcShape && <ExerciseEditor editor={editor} shape={mcShape} />}
    </>
  )
}

export function Board() {
  const saveTimer = useRef<number | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const handleMount = (editor: Editor) => {
    editorRef.current = editor

    db.boards.get(BOARD_ID).then((board) => {
      if (board?.content) {
        try {
          loadSnapshot(editor.store, board.content)
        } catch (e) {
          console.error('[Board] Failed to load snapshot:', e)
        }
      }
    })

    editor.store.listen(
      () => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(async () => {
          try {
            const snapshot = getSnapshot(editor.store)
            const now = Date.now()
            const existing = await db.boards.get(BOARD_ID)
            await db.boards.put({
              id: BOARD_ID,
              title: existing?.title ?? 'Untitled Board',
              course: existing?.course ?? 'General',
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
              content: snapshot,
            })
            console.log('[Board] Saved to IndexedDB')
          } catch (e) {
            console.error('[Board] Failed to save:', e)
          }
        }, 800)
      },
      { scope: 'document' }
    )
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw onMount={handleMount} shapeUtils={customShapeUtils}>
        <BoardUI />
      </Tldraw>
    </div>
  )
}