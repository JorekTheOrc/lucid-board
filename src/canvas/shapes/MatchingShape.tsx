import React, { useState, useEffect, useRef } from 'react'
import { HTMLContainer, T, ShapeUtil, Rectangle2d, resizeBox, useEditor } from 'tldraw'
import type { TLShape, TLResizeInfo } from 'tldraw'
import type { Item } from '../../types/exercise'

const pairValidator = T.object({ left: T.string, right: T.string })
const itemValidator = T.object({
  id: T.string, prompt: T.string.optional(), 
  answer: T.arrayOf(T.any).optional(),
  pairs: T.arrayOf(pairValidator).optional()
})

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'matching': { 
      w: number; h: number; 
      items: Item[]; 
      currentIndex: number; 
      matchedPairs: Record<string, string>; 
      shuffledRight: string[]; 
      selectedLeft?: string | null;
    }
  }
}

export type MatchingShape = TLShape<'matching'>

export class MatchingShapeUtil extends ShapeUtil<MatchingShape> {
  static override type = 'matching' as const
  static override props = { 
    w: T.number, h: T.number, 
    items: T.arrayOf(itemValidator), 
    currentIndex: T.number, 
    matchedPairs: T.jsonValue,
    shuffledRight: T.arrayOf(T.string),
    selectedLeft: T.string.nullable().optional()
  }

  getDefaultProps(): MatchingShape['props'] {
    return { w: 500, h: 300, items: [], currentIndex: 0, matchedPairs: {}, shuffledRight: [], selectedLeft: null }
  }

  override canEditInReadonly() { return true }
  override canResize() { return true }
  override onResize(shape: MatchingShape, info: TLResizeInfo<MatchingShape>) { return resizeBox(shape, info) }

  getGeometry(shape: MatchingShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: MatchingShape) {
    const editor = useEditor()
    const { items, currentIndex, matchedPairs, shuffledRight } = shape.props
    const selectedLeft = shape.props.selectedLeft || null
    const item = items[currentIndex]
    const [wrongPair, setWrongPair] = useState<{ left: string, right: string } | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // АВТО-ВЫСОТА: Подстраиваем размер фигуры под контент
    useEffect(() => {
      if (contentRef.current) {
        const newHeight = contentRef.current.scrollHeight + 40 // + padding
        if (Math.abs(shape.props.h - newHeight) > 2) {
          requestAnimationFrame(() => {
            editor.updateShape({ id: shape.id, type: 'matching', props: { ...shape.props, h: newHeight } })
          })
        }
      }
    }, [item, shape.id, editor, matchedPairs])

    if (!item || !item.pairs) return <div style={{ padding: 20 }}>No pairs available</div>

    const leftItems = item.pairs.map(p => p.left)

    const handleLeftClick = (left: string, e: React.PointerEvent) => {
      e.stopPropagation()
      if (Object.keys(matchedPairs).includes(left)) return
      editor.updateShape({ 
        id: shape.id, type: 'matching', 
        props: { ...shape.props, selectedLeft: left } 
      })
    }

    const handleRightClick = (right: string, e: React.PointerEvent) => {
      e.stopPropagation()
      if (!selectedLeft) return
      if (Object.values(matchedPairs).includes(right)) return

      const correctPair = item.pairs?.find(p => p.left === selectedLeft)
      if (correctPair && correctPair.right === right) {
        editor.updateShape({ 
          id: shape.id, type: 'matching', 
          props: { ...shape.props, matchedPairs: { ...matchedPairs, [selectedLeft]: right }, selectedLeft: null } 
        })
      } else {
        setWrongPair({ left: selectedLeft, right })
        setTimeout(() => setWrongPair(null), 800)
      }
    }

    return (
      <HTMLContainer style={{ pointerEvents: 'all', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', border: '2px solid #e5e7eb', overflow: 'hidden' }}>
        <div ref={contentRef} style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
            {item.prompt || 'Match the pairs:'}
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leftItems.map(left => {
                const isMatched = Object.keys(matchedPairs).includes(left)
                const isSelected = selectedLeft === left
                const isWrong = wrongPair?.left === left
                let bg = '#f3f4f6', border = '1px solid #e5e7eb'
                if (isMatched) { bg = '#dcfce7'; border = '1px solid #22c55e' }
                else if (isWrong) { bg = '#fee2e2'; border = '1px solid #ef4444' }
                else if (isSelected) { bg = '#eff6ff'; border = '1px solid #3b82f6' }

                return (
                  <div key={left} onPointerDown={(e) => handleLeftClick(left, e)} style={{ padding: '10px', borderRadius: '8px', backgroundColor: bg, border, cursor: isMatched ? 'default' : 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s' }}>
                    {left}
                  </div>
                )
              })}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shuffledRight.map(right => {
                const isMatched = Object.values(matchedPairs).includes(right)
                const isWrong = wrongPair?.right === right
                let bg = '#f3f4f6', border = '1px solid #e5e7eb'
                if (isMatched) { bg = '#dcfce7'; border = '1px solid #22c55e' }
                else if (isWrong) { bg = '#fee2e2'; border = '1px solid #ef4444' }
                return (
                  <div key={right} onPointerDown={(e) => handleRightClick(right, e)} style={{ padding: '10px', borderRadius: '8px', backgroundColor: bg, border, cursor: (isMatched || !selectedLeft) ? 'default' : 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s' }}>
                    {right}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: MatchingShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}