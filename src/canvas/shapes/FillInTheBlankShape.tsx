import { useEffect, useRef } from 'react'
import { HTMLContainer, T, useEditor, ShapeUtil, Rectangle2d, resizeBox } from 'tldraw'
import type { TLShape, TLResizeInfo } from 'tldraw'
import type { Item } from '../../types/exercise'

const itemValidator = T.object({
  id: T.string, prompt: T.string.optional(), answer: T.arrayOf(T.any),
  hint: T.string.optional(), translation: T.string.optional(), explanation: T.string.optional(),
  word_limit: T.number.optional(), word_box: T.arrayOf(T.string).optional(),
  options: T.arrayOf(T.any).optional(), pairs: T.arrayOf(T.any).optional(),
  tokens: T.arrayOf(T.string).optional(), correct_order: T.arrayOf(T.string).optional(),
  alternatives: T.arrayOf(T.string).optional(), vocabulary: T.arrayOf(T.any).optional()
})

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'fill-in-the-blank': { w: number; h: number; items: Item[]; userInputs: string[]; confirmedIndices: boolean[]; currentIndex?: number; }
  }
}

export type FillInTheBlankShape = TLShape<'fill-in-the-blank'>

export class FillInTheBlankShapeUtil extends ShapeUtil<FillInTheBlankShape> {
  static override type = 'fill-in-the-blank' as const
  static override props = { 
    w: T.number, h: T.number, items: T.arrayOf(itemValidator), userInputs: T.arrayOf(T.string),
    confirmedIndices: T.arrayOf(T.boolean), currentIndex: T.number.optional()
  }

  getDefaultProps(): FillInTheBlankShape['props'] {
    return { w: 500, h: 300, items: [], userInputs: [], confirmedIndices: [], currentIndex: 0 }
  }

  override canEditInReadonly() { return true }
  override canResize() { return true }
  override onResize(shape: FillInTheBlankShape, info: TLResizeInfo<FillInTheBlankShape>) { return resizeBox(shape, info) }

  getGeometry(shape: FillInTheBlankShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: FillInTheBlankShape) {
    const editor = useEditor()
    const { items, userInputs } = shape.props
    const safeConfirmed = shape.props.confirmedIndices || []
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (contentRef.current) {
        const newHeight = contentRef.current.scrollHeight + 50
        if (Math.abs(shape.props.h - newHeight) > 2) {
          requestAnimationFrame(() => {
            editor.updateShape({ id: shape.id, type: 'fill-in-the-blank', props: { ...shape.props, h: newHeight } })
          })
        }
      }
    }, [items, shape.id, editor, shape.props])

    const handleConfirm = (qIndex: number) => {
      const newConfirmed = [...safeConfirmed]
      newConfirmed[qIndex] = true
      editor.updateShape({ id: shape.id, type: 'fill-in-the-blank', props: { ...shape.props, confirmedIndices: newConfirmed } })

      setTimeout(() => {
        const nextInput = document.getElementById(`fb-input-${shape.id}-${qIndex + 1}`) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
          const rect = nextInput.getBoundingClientRect()
          const point = editor.screenToPage({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          editor.centerOnPoint(point, { animation: { duration: 300 } })
        }
      }, 50)
    }

    return (
      <HTMLContainer style={{ pointerEvents: 'all', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', border: '2px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Fill in the Blank ({items.length} questions)</span>
        </div>

        <div ref={contentRef} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {items.map((item, qIndex) => {
            const userInput = userInputs[qIndex] || ''
            const isConfirmed = safeConfirmed[qIndex]
            const isCorrect = item.answer.some(ans => String(ans).toLowerCase() === userInput.trim().toLowerCase())
            
            let bgColor = 'white', borderColor = '#d1d5db'
            if (isConfirmed) {
              bgColor = isCorrect ? '#dcfce7' : '#fee2e2'
              borderColor = isCorrect ? '#22c55e' : '#ef4444'
            }

            const parts = (item.prompt || 'Type here ___').split('___')

            return (
              <div key={item.id} id={`fb-${shape.id}-${qIndex}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px', borderBottom: qIndex < items.length - 1 ? '1px dashed #e5e7eb' : 'none' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#111827', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  {qIndex + 1}. {parts[0]}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input id={`fb-input-${shape.id}-${qIndex}`} type="text" disabled={isConfirmed} value={userInput}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newInputs = [...userInputs]
                        newInputs[qIndex] = e.target.value
                        editor.updateShape({ id: shape.id, type: 'fill-in-the-blank', props: { ...shape.props, userInputs: newInputs } })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (userInput.trim().length > 0 && !isConfirmed) handleConfirm(qIndex)
                        }
                      }}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: `2px solid ${borderColor}`, fontSize: '16px', width: '150px', outline: 'none', backgroundColor: bgColor, color: '#111827', fontWeight: 'normal', transition: 'all 0.2s' }}
                      placeholder="..."
                    />
                    {!isConfirmed && userInput.trim().length > 0 && (
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => handleConfirm(qIndex)} style={{ padding: '4px 8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✓</button>
                    )}
                  </div>
                  {parts[1]}
                </h3>
              </div>
            )
          })}
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: FillInTheBlankShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}