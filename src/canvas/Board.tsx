import { useState, useEffect, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, useValue, useEditor, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

import { db } from '../db/db'
import { MultipleChoiceShapeUtil, type MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import { FillInTheBlankShapeUtil } from './shapes/FillInTheBlankShape'
import { RichTextShapeUtil } from './shapes/RichTextShape'
import { AudioShapeUtil, AudioAssetUtil } from './shapes/AudioShape'
import { ExerciseEditor } from './ExerciseEditor'
import { AiBuilder } from './AiBuilder'
import type { Item } from '../types/exercise'

const BOARD_ID = 'default-board'
const customShapeUtils = [MultipleChoiceShapeUtil, FillInTheBlankShapeUtil, RichTextShapeUtil, AudioShapeUtil]

function BoardUI({ isTeacher, setIsTeacher }: { isTeacher: boolean, setIsTeacher: (v: boolean) => void }) {
  const editor = useEditor()
  const selectedShapes = useValue('selected', () => editor.getSelectedShapes(), [editor])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [studentName, setStudentName] = useState('Student')
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null)
  
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Ищем только упражнения для боковой панели (rich-text редактируется на холсте)
  const exerciseShape = selectedShapes.find(s => s.type === 'multiple-choice' || s.type === 'fill-in-the-blank')

  useEffect(() => {
    editor.updateInstanceState({ isReadonly: !isTeacher })
  }, [editor, isTeacher])

  const handleExport = async (isProgress = false) => {
    try {
      const zipData: Record<string, Uint8Array> = {}

      if (isProgress) {
        const allShapes = editor.store.allRecords().filter((r: any) => r.typeName === 'shape')
        const results: any = {}

        allShapes.forEach((shape: any) => {
          if (shape.type === 'multiple-choice') {
            results[shape.id] = { selectedIndices: shape.props.selectedIndices, confirmedIndices: shape.props.confirmedIndices }
          } else if (shape.type === 'fill-in-the-blank') {
            results[shape.id] = { userInputs: shape.props.userInputs, confirmedIndices: shape.props.confirmedIndices }
          }
        })

        const progressData = { studentName, timestamp: Date.now(), results }
        zipData['progress.json'] = strToU8(JSON.stringify(progressData, null, 2))
      } else {
        const snapshot = getSnapshot(editor.store)
        zipData['board.json'] = strToU8(JSON.stringify(snapshot, null, 2))

        const assets = editor.store.allRecords().filter((r: any) => r.typeName === 'asset')
        for (const asset of assets) {
          try {
            const assetRecord = editor.getAsset(asset.id) as any
            if (assetRecord && assetRecord.props && assetRecord.props.src) {
              const response = await fetch(assetRecord.props.src)
              const blob = await response.blob()
              zipData[`assets/${asset.id}`] = new Uint8Array(await blob.arrayBuffer())
            }
          } catch (e) { console.warn(e) }
        }
        
        // Экспорт аудио из Dexie
        const allShapes = editor.store.allRecords().filter((r: any) => r.typeName === 'shape')
        for (const shape of allShapes) {
          if (shape.type === 'audio-player' && shape.props.assetId) {
            const data = await db.assets.get(shape.props.assetId)
            if (data && data.blob) {
              zipData[`assets/${shape.props.assetId}`] = new Uint8Array(await data.blob.arrayBuffer())
            }
          }
        }
      }

      const zipped = zipSync(zipData, { level: 9 })
      const blob = new Blob([zipped], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isProgress ? `progress-${studentName}-${Date.now()}.zip` : `lucid-board-template.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast(isProgress ? 'Progress exported!' : 'Template exported!', 'success')
    } catch (err) {
      console.error(err)
      showToast("Export failed", 'error')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const arrayBuffer = await file.arrayBuffer()
      const unzipped = unzipSync(new Uint8Array(arrayBuffer))
      
      if (unzipped['progress.json']) {
        const progressStr = strFromU8(unzipped['progress.json'])
        const progressData = JSON.parse(progressStr)
        
        Object.keys(progressData.results).forEach(shapeId => {
          const res = progressData.results[shapeId]
          const shape = editor.getShape(shapeId as any) as any
          if (shape) {
            const updates: any = { ...shape.props }
            if (res.selectedIndices) updates.selectedIndices = res.selectedIndices
            if (res.userInputs) updates.userInputs = res.userInputs
            if (res.confirmedIndices) updates.confirmedIndices = res.confirmedIndices
            editor.updateShape({ id: shape.id, type: shape.type, props: updates })
          }
        })
        showToast(`Loaded progress for ${progressData.studentName}!`, 'success')
        return
      }

      if (unzipped['board.json']) {
        for (const path in unzipped) {
          if (path.startsWith('assets/')) {
            const assetId = path.replace('assets/', '')
            const blob = new Blob([unzipped[path]])
            try { if (editor.assets && typeof editor.assets.put === 'function') await editor.assets.put(assetId, blob) } catch (e) {}
          }
        }
        const jsonStr = strFromU8(unzipped['board.json'])
        loadSnapshot(editor.store, JSON.parse(jsonStr))
        showToast('Template loaded!', 'success')
        return
      }
      throw new Error("Unknown ZIP structure")
    } catch (err) {
      console.error(err)
      showToast("Import failed: Invalid ZIP", 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    editor.putExternalContent({ type: 'files', files: [file], point: editor.getViewportPageBounds().center })
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleAddPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const center = editor.getViewportPageBounds().center
      let currentY = center.y - 300
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85))
        const imgFile = new File([blob], `page-${i}.jpg`, { type: 'image/jpeg' })
        editor.putExternalContent({ type: 'files', files: [imgFile], point: { x: center.x, y: currentY } })
        currentY += viewport.height + 20
      }
    } catch (err) {
      console.error(err)
      showToast('PDF read error', 'error')
    } finally {
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handleAddAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const assetId = `asset:${crypto.randomUUID()}`
    const center = editor.getViewportPageBounds().center

    // Сохраняем файл напрямую в Dexie
    await db.assets.put({ id: assetId, blob: new Blob([file], { type: file.type || 'audio/mpeg' }) })

    editor.createAssets([{
      id: assetId as any,
      type: 'audio',
      typeName: 'asset',
      props: {
        name: file.name,
        src: '', 
        w: 0,
        h: 0,
        mimeType: file.type,
        isAnimated: false
      },
      meta: {}
    }])

    editor.createShape({
      type: 'audio-player',
      x: center.x - 225,
      y: center.y - 50,
      props: { w: 450, h: 100, assetId, transcript: '' }
    })
    
    if (audioInputRef.current) audioInputRef.current.value = ''
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
      {toast && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '8px', color: 'white', fontWeight: 'bold', backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 3000 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ position: 'absolute', top: 8, left: isTeacher ? 340 : 16, zIndex: 1000, display: 'flex', alignItems: 'center', height: 40, gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => setIsTeacher(!isTeacher)} style={{ padding: '0 12px', height: '100%', backgroundColor: isTeacher ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
          {isTeacher ? '👨‍🏫 Teacher Mode' : '🎓 Student Mode'}
        </button>

        {isTeacher ? (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={addMultiChoice} style={{ padding: '0 12px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Multi Choice</button>
            <button onClick={addFillBlank} style={{ padding: '0 12px', height: '100%', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Fill Blank</button>
            <button onClick={addRichText} style={{ padding: '0 12px', height: '100%', backgroundColor: '#14b8a6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Reading</button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => imageInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Image</button>
            <button onClick={() => pdfInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ PDF</button>
            <button onClick={() => audioInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Audio</button>
            <input type="file" accept="audio/*" ref={audioInputRef} onChange={handleAddAudio} style={{ display: 'none' }} />
            <input type="file" accept="image/*" ref={imageInputRef} onChange={handleAddImage} style={{ display: 'none' }} />
            <input type="file" accept="application/pdf" ref={pdfInputRef} onChange={handleAddPdf} style={{ display: 'none' }} />

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => setIsAiOpen(true)} style={{ padding: '0 12px', height: '100%', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✨ AI Import</button>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <button onClick={() => handleExport(false)} style={{ padding: '0 12px', height: '100%', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Export ZIP</button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0 12px', height: '100%', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Import ZIP</button>
            <input type="file" accept=".zip" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </>
        ) : (
          <>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
            <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Your Name" style={{ padding: '0 10px', height: '100%', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '12px' }} />
            <button onClick={() => handleExport(true)} style={{ padding: '0 16px', height: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Export My Progress</button>
          </>
        )}
      </div>
      {isTeacher && exerciseShape && <ExerciseEditor editor={editor} shape={exerciseShape as any} />}
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
      <Tldraw onMount={handleMount} shapeUtils={customShapeUtils} assetUtils={[AudioAssetUtil]} hideUi={!isTeacher}>
        <BoardUI isTeacher={isTeacher} setIsTeacher={setIsTeacher} />
      </Tldraw>
    </div>
  )
}