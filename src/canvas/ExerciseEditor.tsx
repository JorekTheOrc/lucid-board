import React from 'react'
import type { Editor } from 'tldraw'
import type { MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import type { FillInTheBlankShape } from './shapes/FillInTheBlankShape'
import type { Item } from '../types/exercise'

interface Props {
  editor: Editor
  shape: MultipleChoiceShape | FillInTheBlankShape
}

export function ExerciseEditor({ editor, shape }: Props) {
  // Защита от старых карточек без массива items
  const items = shape.props.items || []
  const currentIndex = (shape.props as any).currentIndex || 0
  const item = items[currentIndex] || { id: '1', prompt: '', options: [], answer: [] }

  const updateItem = (updates: Partial<Item>) => {
    const newItems = [...items]
    newItems[currentIndex] = { ...item, ...updates }
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, items: newItems } } as any)
  }

  const addQuestion = () => {
    const newItems = [...items, { id: crypto.randomUUID(), prompt: shape.type === 'multiple-choice' ? 'New Question' : 'She ___ to school.', options: shape.type === 'multiple-choice' ? [{ id: crypto.randomUUID(), text: 'Option 1' }, { id: crypto.randomUUID(), text: 'Option 2' }] : [], answer: shape.type === 'multiple-choice' ? ['Option 1'] : ['goes'] }]
    const newProps = { ...shape.props, items: newItems, currentIndex: newItems.length - 1 }
    if (shape.type === 'fill-in-the-blank') {
        (newProps as any).userInputs = [...((shape.props as any).userInputs || []), '']
        (newProps as any).confirmedIndices = [...((shape.props as any).confirmedIndices || []), false]
    } else {
        (newProps as any).selectedIndices = [...((shape.props as any).selectedIndices || []), null]
        (newProps as any).confirmedIndices = [...((shape.props as any).confirmedIndices || []), false]
    }
    editor.updateShape({ id: shape.id, type: shape.type, props: newProps } as any)
  }

  const removeQuestion = () => {
    const newItems = items.filter((_, i) => i !== currentIndex)
    const newProps = { ...shape.props, items: newItems, currentIndex: Math.max(0, currentIndex - 1) }
    if (shape.type === 'fill-in-the-blank') {
         (newProps as any).userInputs = ((shape.props as any).userInputs || []).filter((_: any, i: number) => i !== currentIndex)
         (newProps as any).confirmedIndices = ((shape.props as any).confirmedIndices || []).filter((_: any, i: number) => i !== currentIndex)
    } else {
         (newProps as any).selectedIndices = ((shape.props as any).selectedIndices || []).filter((_: any, i: number) => i !== currentIndex)
         (newProps as any).confirmedIndices = ((shape.props as any).confirmedIndices || []).filter((_: any, i: number) => i !== currentIndex)
    }
    editor.updateShape({ id: shape.id, type: shape.type, props: newProps } as any)
  }

  const options = item.options || []

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, width: '320px', height: '100%', backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 1000, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Edit {shape.type === 'multiple-choice' ? 'Multiple Choice' : 'Fill Blank'}</h2>
        <button onClick={removeQuestion} style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Delete Q</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
        {items.map((_, i) => (
          <button key={i} onClick={() => editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, currentIndex: i } } as any)} style={{ padding: '6px 12px', backgroundColor: i === currentIndex ? '#3b82f6' : '#f3f4f6', color: i === currentIndex ? 'white' : '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{i + 1}</button>
        ))}
        <button onClick={addQuestion} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>QUESTION PROMPT</label>
        <textarea value={item.prompt || ''} onChange={(e) => updateItem({ prompt: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', minHeight: '60px', resize: 'vertical' }} />
      </div>

      {shape.type === 'multiple-choice' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>OPTIONS (SELECT CORRECT)</label>
          {options.map((opt, i) => {
            const isCorrect = item.answer.includes(opt.text)
            return (
              <div key={opt.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" checked={isCorrect} onChange={() => updateItem({ answer: [opt.text] })} style={{ cursor: 'pointer' }} />
                <input type="text" value={opt.text} onChange={(e) => {
                  const newOptions = [...options]
                  const oldText = newOptions[i].text
                  newOptions[i] = { ...newOptions[i], text: e.target.value }
                  let newAnswer = [...item.answer]
                  const answerIdx = newAnswer.indexOf(oldText)
                  if (answerIdx !== -1) newAnswer[answerIdx] = e.target.value
                  updateItem({ options: newOptions, answer: newAnswer })
                }} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                <button onClick={() => updateItem({ options: options.filter((_, idx) => idx !== i) })} style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
              </div>
            )
          })}
          <button onClick={() => updateItem({ options: [...options, { id: crypto.randomUUID(), text: 'New Option' }] })} style={{ padding: '8px', backgroundColor: '#f3f4f6', border: '1px dashed #9ca3af', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}>+ Add Option</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>CORRECT ANSWERS (COMMA SEPARATED)</label>
          <input type="text" value={item.answer.join(', ')} onChange={(e) => updateItem({ answer: e.target.value.split(',').map(s => s.trim()) })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} placeholder="goes, went" />
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Use ___ in the prompt to mark the blank space.</span>
        </div>
      )}
    </div>
  )
}