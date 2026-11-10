import { HTMLContainer, T, ShapeUtil, Rectangle2d, resizeBox, useEditor } from 'tldraw'
import type { TLShape, TLResizeInfo } from 'tldraw'
import { useEffect, useRef } from 'react'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'rich-text': { w: number; h: number; title?: string; content: string; isEditing?: boolean; }
  }
}

export type RichTextShape = TLShape<'rich-text'>

export class RichTextShapeUtil extends ShapeUtil<RichTextShape> {
  static override type = 'rich-text' as const
  static override props = { 
    w: T.number, 
    h: T.number, 
    title: T.string.optional(), 
    content: T.string, 
    isEditing: T.boolean.optional() 
  }

  getDefaultProps(): RichTextShape['props'] {
    return { w: 450, h: 200, title: '', content: '<h2>Reading Text</h2><p>Paste your text here...</p>', isEditing: false }
  }

  override canEditInReadonly() { return false }
  override canResize() { return true }
  override onResize(shape: RichTextShape, info: TLResizeInfo<RichTextShape>) { return resizeBox(shape, info) }

  // Убрали onDoubleClick отсюда, перенесли в компонент

  getGeometry(shape: RichTextShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: RichTextShape) {
    const editor = useEditor()
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (contentRef.current) {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const newHeight = entry.target.scrollHeight + 40
            if (Math.abs(shape.props.h - newHeight) > 2) {
              requestAnimationFrame(() => {
                editor.updateShape({ id: shape.id, type: 'rich-text', props: { ...shape.props, h: newHeight } })
              })
            }
          }
        })
        observer.observe(contentRef.current)
        return () => observer.disconnect()
      }
    }, [shape.props.content, shape.id, editor, shape.props.isEditing])

    useEffect(() => {
      if (shape.props.isEditing && contentRef.current) {
        contentRef.current.focus()
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, [shape.props.isEditing])

    return (
      <HTMLContainer 
        style={{ 
          pointerEvents: 'all', 
          backgroundColor: '#fff', 
          borderRadius: '12px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
          display: 'flex', 
          flexDirection: 'column', 
          border: shape.props.isEditing ? '2px solid #3b82f6' : '2px solid #e5e7eb' 
        }}
        // Включаем редактирование по двойному клику
        onDoubleClick={(e) => {
          e.stopPropagation()
          editor.updateShape({ id: shape.id, type: 'rich-text', props: { ...shape.props, isEditing: true } })
        }}
      >
        <style>{`
          .rich-text-content h2 { font-size: 20px; font-weight: bold; margin: 0 0 12px 0; color: #111; }
          .rich-text-content h3 { font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; color: #111; }
          .rich-text-content p { font-size: 15px; line-height: 1.6; margin: 0 0 12px 0; color: #374151; }
          .rich-text-content ul { padding-left: 20px; margin: 0 0 12px 0; }
          .rich-text-content li { font-size: 15px; line-height: 1.6; margin-bottom: 4px; color: #374151; }
          .rich-text-content strong { font-weight: bold; color: #111; }
          .rich-text-content:focus { outline: none; }
        `}</style>
        
        <div 
          ref={contentRef} 
          className="rich-text-content"
          contentEditable={shape.props.isEditing}
          suppressContentEditableWarning
          style={{ padding: '20px', flex: 1, cursor: shape.props.isEditing ? 'text' : 'default' }}
          dangerouslySetInnerHTML={{ __html: shape.props.content }}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const newHtml = e.currentTarget.innerHTML
            editor.updateShape({ id: shape.id, type: 'rich-text', props: { ...shape.props, content: newHtml, isEditing: false } })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.currentTarget.blur()
            }
          }}
        />
      </HTMLContainer>
    )
  }

  override getIndicatorPath(shape: RichTextShape): Path2D {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}