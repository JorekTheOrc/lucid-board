import React from 'react'
import type { Editor } from 'tldraw'
import type { MultipleChoiceShape } from './shapes/MultipleChoiceShape'

interface Props {
  editor: Editor
  shape: MultipleChoiceShape
}

export function ExerciseEditor({ editor, shape }: Props) {
  const { item } = shape.props
  const options = item.options || []

  const updateItem = (updates: Partial<typeof item>) => {
    editor.updateShape({
      id: shape.id,
      type: 'multiple-choice',
      props: {
        ...shape.props,
        item: { ...item, ...updates },
      },
    })
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateItem({ prompt: e.target.value })
  }

  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...options]
    const oldText = newOptions[index].text
    newOptions[index] = { ...newOptions[index], text }
    
    // Если меняем текст правильного ответа, обновляем и массив answer
    let newAnswer = [...item.answer]
    const answerIdx = newAnswer.indexOf(oldText)
    if (answerIdx !== -1) {
      newAnswer[answerIdx] = text
    }

    updateItem({ options: newOptions, answer: newAnswer })
  }

  const markAsCorrect = (index: number) => {
    // В Multiple Choice правильный ответ только один
    updateItem({ answer: [options[index].text] })
  }

  const addOption = () => {
    const newOptions = [...options, { id: crypto.randomUUID(), text: 'New Option' }]
    updateItem({ options: newOptions })
  }

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index)
    // Если удалили правильный ответ, сбрасываем answer
    let newAnswer = item.answer
    if (item.answer.includes(options[index].text)) {
      newAnswer = []
    }
    updateItem({ options: newOptions, answer: newAnswer })
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '320px',
      height: '100%',
      backgroundColor: 'white',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
      zIndex: 1000,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflowY: 'auto'
    }}>
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Edit Exercise</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>QUESTION PROMPT</label>
        <textarea
          value={item.prompt || ''}
          onChange={(e) => updateItem({ prompt: e.target.value })}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', minHeight: '60px', resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>OPTIONS (SELECT CORRECT)</label>
        {options.map((opt, i) => {
          const isCorrect = item.answer.includes(opt.text)
          return (
            <div key={opt.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="radio"
                checked={isCorrect}
                onChange={() => markAsCorrect(i)}
                style={{ cursor: 'pointer' }}
                title="Mark as correct"
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) => handleOptionTextChange(i, e.target.value)}
                style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <button
                onClick={() => removeOption(i)}
                style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          )
        })}
        <button
          onClick={addOption}
          style={{ padding: '8px', backgroundColor: '#f3f4f6', border: '1px dashed #9ca3af', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}
        >
          + Add Option
        </button>
      </div>
    </div>
  )
}