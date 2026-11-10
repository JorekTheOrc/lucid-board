import { useEffect, useRef } from 'react'
import { HTMLContainer, T, useEditor, ShapeUtil, Rectangle2d, resizeBox } from 'tldraw'
import type { TLShape, TLResizeInfo } from 'tldraw'
import type { Item } from '../../types/exercise'

const optionValidator = T.object({ id: T.string, text: T.string })
const itemValidator = T.object({
  id: T.string, prompt: T.string.optional(), options: T.arrayOf(optionValidator).optional(),
  answer: T.arrayOf(T.any), hint: T.string.optional(), explanation: T.string.optional(),
  translation: T.string.optional(), vocabulary: T.arrayOf(T.any).optional(),
  word_limit: T.number.optional(), word_box: T.arrayOf(T.string).optional(),
  pairs: T.arrayOf(T.any).optional(), tokens: T.arrayOf(T.string).optional(),
  correct_order: T.arrayOf(T.string).optional(), alternatives: T.arrayOf(T.string).optional()
})

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'multiple-choice': { w: number; h: number; items: Item[]; selectedIndices: (number | null)[]; confirmedIndices: boolean[]; currentIndex?: number; }
  }
}

export type MultipleChoiceShape = TLShape<'multiple-choice'>

export class MultipleChoiceShapeUtil extends ShapeUtil<MultipleChoiceShape> {
  static override type = 'multiple-choice' as const
  static override props = { 
    w: T.number, h: T.number, 
    items: T.arrayOf(itemValidator), 
    selectedIndices: T.arrayOf(T.number.nullable()),
    confirmedIndices: T.arrayOf(T.boolean),
    currentIndex: T.number.optional() // Нужно только для редактора
  }

  getDefaultProps(): MultipleChoiceShape['props'] {
    return { w: 500, h: 600, items: [], selectedIndices: [], confirmedIndices: [], currentIndex: 0 }
  }

  override canEditInReadonly() { return true }
  override canResize() { return true }
  override onResize(shape: MultipleChoiceShape, info: TLResizeInfo<MultipleChoiceShape>) { return resizeBox(shape, info) }

  getGeometry(shape: MultipleChoiceShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: MultipleChoiceShape) {
    const editor = useEditor()
    const { items, selectedIndices } = shape.props
    const safeConfirmed = shape.props.confirmedIndices || [] // Защита от старых данных
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (contentRef.current) {
        const newHeight = contentRef.current.scrollHeight + 50
        if (Math.abs(shape.props.h - newHeight) > 2) {
          requestAnimationFrame(() => {
            editor.updateShape({ id: shape.id, type: 'multiple-choice', props: { ...shape.props, h: newHeight } })
          })
        }
      }
    }, [items, shape.id, editor, shape.props])

    const handleConfirm = (qIndex: number) => {
      const newConfirmed = [...safeConfirmed]
      newConfirmed[qIndex] = true
      editor.updateShape({ id: shape.id, type: 'multiple-choice', props: { ...shape.props, confirmedIndices: newConfirmed } })

      setTimeout(() => {
        const nextQ = document.getElementById(`q-${shape.id}-${qIndex + 1}`)
        if (nextQ) {
          const rect = nextQ.getBoundingClientRect()
          const point = editor.screenToPage({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          editor.centerOnPoint(point, { animation: { duration: 300 } })
        }
      }, 50)
    }

    return (
      <HTMLContainer style={{ pointerEvents: 'all', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', border: '2px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Multiple Choice ({items.length} questions)</span>
        </div>

        <div ref={contentRef} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {items.map((item, qIndex) => {
            const options = item.options || []
            const selectedIndex = selectedIndices[qIndex]
            const isConfirmed = safeConfirmed[qIndex]

            return (
              <div key={item.id} id={`q-${shape.id}-${qIndex}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px', borderBottom: qIndex < items.length - 1 ? '1px dashed #e5e7eb' : 'none' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                  {qIndex + 1}. {item.prompt || 'No question prompt'}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {options.map((option, index) => {
                    const isSelected = selectedIndex === index
                    const isCorrect = item.answer.includes(option.text)
                    
                    let bgColor = 'transparent', borderColor = 'transparent'
                    if (isConfirmed && isSelected) {
                      if (isCorrect) { bgColor = '#dcfce7'; borderColor = '#22c55e' }
                      else { bgColor = '#fee2e2'; borderColor = '#ef4444' }
                    } else if (isSelected && !isConfirmed) {
                      bgColor = '#eff6ff'; borderColor = '#3b82f6'
                    }

                    return (
                      <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', cursor: isConfirmed ? 'default' : 'pointer', padding: '8px', borderRadius: '6px', backgroundColor: bgColor, border: `1px solid ${borderColor}`, transition: 'all 0.2s', opacity: isConfirmed && !isSelected ? 0.4 : 1 }}>
                          <input type="radio" disabled={isConfirmed} name={`mc-${shape.id}-${qIndex}`} checked={isSelected} onChange={() => {
                              const newSelected = [...selectedIndices]
                              newSelected[qIndex] = index
                              editor.updateShape({ id: shape.id, type: 'multiple-choice', props: { ...shape.props, selectedIndices: newSelected } })
                            }} style={{ cursor: isConfirmed ? 'default' : 'pointer' }} />
                          <span style={{ color: '#374151', fontSize: '14px' }}>{option.text}</span>
                        </label>
                        
                        {isSelected && !isConfirmed && (
                           <button onPointerDown={(e) => e.stopPropagation()} onClick={() => handleConfirm(qIndex)} style={{ padding: '6px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✓</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: MultipleChoiceShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}