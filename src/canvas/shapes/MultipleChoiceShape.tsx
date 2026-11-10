import {
  HTMLContainer,
  T,
  useEditor,
  ShapeUtil,
  Rectangle2d,
} from 'tldraw'
import type { TLShape } from 'tldraw'
import type { Item } from '../../types/exercise'

const optionValidator = T.object({
  id: T.string,
  text: T.string,
  vocabulary: T.arrayOf(
    T.object({
      text: T.string,
      translation: T.string,
    })
  ).optional(),
})

const vocabValidator = T.object({
  text: T.string,
  translation: T.string,
})

const itemValidator = T.object({
  id: T.string,
  prompt: T.string.optional(),
  vocabulary: T.arrayOf(vocabValidator).optional(),
  options: T.arrayOf(optionValidator).optional(),
  answer: T.arrayOf(T.any),
  hint: T.string.optional(),
  translation: T.string.optional(),
  explanation: T.string.optional(),
  word_limit: T.number.optional(),
  word_box: T.arrayOf(T.string).optional(),
  pairs: T.arrayOf(T.object({ left: T.string, right: T.string })).optional(),
  tokens: T.arrayOf(T.string).optional(),
  correct_order: T.arrayOf(T.string).optional(),
  alternatives: T.arrayOf(T.string).optional(),
})

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'multiple-choice': {
      w: number
      h: number
      item: Item
      selectedIndex: number | null
    }
  }
}

export type MultipleChoiceShape = TLShape<'multiple-choice'>

export class MultipleChoiceShapeUtil extends ShapeUtil<MultipleChoiceShape> {
  static override type = 'multiple-choice' as const
  static override props = {
    w: T.number,
    h: T.number,
    item: itemValidator,
    selectedIndex: T.number.nullable(),
  }

  getDefaultProps(): MultipleChoiceShape['props'] {
    return {
      w: 400,
      h: 250,
      item: {
        id: 'item-1',
        prompt: 'Select the correct answer',
        options: [],
        answer: [],
      },
      selectedIndex: null,
    }
  }

  getGeometry(shape: MultipleChoiceShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  component(shape: MultipleChoiceShape) {
    const editor = useEditor()
    const { item, selectedIndex } = shape.props
    const options = item.options || []

    return (
      <HTMLContainer
        style={{
          pointerEvents: 'all',
          padding: '16px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: '2px solid #e5e7eb',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
          {item.prompt || 'No question prompt'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((option, index) => {
            const isSelected = selectedIndex === index
            const isCorrect = item.answer.includes(option.text)
            
            let bgColor = 'transparent'
            let borderColor = 'transparent'
            if (isSelected) {
              if (isCorrect) {
                bgColor = '#dcfce7'
                borderColor = '#22c55e'
              } else {
                bgColor = '#fee2e2'
                borderColor = '#ef4444'
              }
            }

            return (
              <label
                key={option.id}
                onPointerDown={(e) => e.stopPropagation()} // Защита от перехвата клика холстом
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="radio"
                  name={`mc-${shape.id}`}
                  checked={isSelected}
                  onChange={() => {
                    // ВАЖНО: Передаем все существующие props + новый selectedIndex
                    editor.updateShape({
                      id: shape.id,
                      type: 'multiple-choice',
                      props: { ...shape.props, selectedIndex: index },
                    })
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: '#374151', fontSize: '14px' }}>{option.text}</span>
              </label>
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