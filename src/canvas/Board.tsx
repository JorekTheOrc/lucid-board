import { useEffect, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { db } from '../db/db'

const BOARD_ID = 'default-board'

export function Board() {
  const saveTimer = useRef<number | null>(null)

  const handleMount = (editor: Editor) => {
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
      <Tldraw onMount={handleMount} />
    </div>
  )
}