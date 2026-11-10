import React from 'react'
import type { Editor } from 'tldraw'
import type { MultipleChoiceShape } from './shapes/MultipleChoiceShape'
import type { FillInTheBlankShape } from './shapes/FillInTheBlankShape'
import type { MatchingShape } from './shapes/MatchingShape'
import type { Item } from '../types/exercise'

interface Props {
  editor: Editor
  shape: MultipleChoiceShape | FillInTheBlankShape | MatchingShape
}

export function ExerciseEditor({ editor, shape }: Props) {
  if (!shape || !shape.props || !shape.props.items) return null;

  const { items } = shape.props
  const currentIndex = (shape.props as any).currentIndex || 0
  const item = items[currentIndex] || { id: '1', prompt: '', options: [], answer: [], pairs: [] }

  const updateItem = (updates: Partial<Item>) => {
    const newItems = [...items]
    newItems[currentIndex] = { ...item, ...updates }
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, items: newItems } } as any)
  }

  const addQuestion = () => {
    let newItem: Item = { id: crypto.randomUUID(), prompt: 'New', answer: [] }
    if (shape.type === 'multiple-choice') newItem = { ...newItem, prompt: 'New Question', options: [{ id: crypto.randomUUID(), text: 'Opt 1' }, { id: crypto.randomUUID(), text: 'Opt 2' }], answer: ['Opt 1'] }
    if (shape.type === 'fill-in-the-blank') newItem = { ...newItem, prompt: 'She ___ to school.', answer: ['goes'] }
    if (shape.type === 'matching') newItem = { ...newItem, prompt: 'Match the pairs:', pairs: [{ left: 'Apple', right: 'Яблоко' }] }

    const newItems = [...items, newItem]
    const newProps = { ...shape.props, items: newItems, currentIndex: newItems.length - 1 }
    
    if (shape.type === 'fill-in-the-blank') {
        (newProps as any).userInputs = [...((shape.props as any).userInputs || []), '']
        (newProps as any).confirmedIndices = [...((shape.props as any).confirmedIndices || []), false]
    } else if (shape.type === 'multiple-choice') {
        (newProps as any).selectedIndices = [...((shape.props as any).selectedIndices || []), null]
        (newProps as any).confirmedIndices = [...((shape.props as any).confirmedIndices || []), false]
    } else if (shape.type === 'matching') {
        (newProps as any).shuffledRight = [...((shape.props as any).shuffledRight || []), 'Яблоко']
        (newProps as any).matchedPairs = {}
    }
    editor.updateShape({ id: shape.id, type: shape.type, props: newProps } as any)
  }

  const removeQuestion = () => {
    const newItems = items.filter((_, i) => i !== currentIndex)
    const newProps = { ...shape.props, items: newItems, currentIndex: Math.max(0, currentIndex - 1) }
    editor.updateShape({ id: shape.id, type: shape.type, props: newProps } as any)
  }

  const resetProgress = () => {
    if (shape.type === 'multiple-choice') {
      editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, selectedIndices: items.map(() => null), confirmedIndices: items.map(() => false) } } as any)
    } else if (shape.type === 'fill-in-the-blank') {
      editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, userInputs: items.map(() => ''), confirmedIndices: items.map(() => false) } } as any)
    } else if (shape.type === 'matching') {
      editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, matchedPairs: {} } } as any)
    }
  }

  const options = item.options || []

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, width: '320px', height: '100%', backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 1000, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Edit {shape.type}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={resetProgress} style={{ padding: '4px 8px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Reset</button>
          <button onClick={removeQuestion} style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Del Q</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
        {items.map((_, i) => (
          <button key={i} onClick={() => editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, currentIndex: i } } as any)} style={{ padding: '6px 12px', backgroundColor: i === currentIndex ? '#3b82f6' : '#f3f4f6', color: i === currentIndex ? 'white' : '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{i + 1}</button>
        ))}
        <button onClick={addQuestion} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>PROMPT</label>
        <textarea value={item.prompt || ''} onChange={(e) => updateItem({ prompt: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', minHeight: '60px', resize: 'vertical' }} />
      </div>

      {shape.type === 'matching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>PAIRS</label>
          {(item.pairs || []).map((pair, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="text" value={pair.left} onChange={(e) => {
                const newPairs = [...(item.pairs || [])]
                newPairs[i] = { ...newPairs[i], left: e.target.value }
                updateItem({ pairs: newPairs })
              }} placeholder="Left" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              <input type="text" value={pair.right} onChange={(e) => {
                const newPairs = [...(item.pairs || [])]
                newPairs[i] = { ...newPairs[i], right: e.target.value }
                updateItem({ pairs: newPairs })
              }} placeholder="Right" style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              <button onClick={() => updateItem({ pairs: (item.pairs || []).filter((_, idx) => idx !== i) })} style={{ padding: '6px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => updateItem({ pairs: [...(item.pairs || []), { left: '', right: '' }] })} style={{ padding: '8px', backgroundColor: '#f3f4f6', border: '1px dashed #9ca3af', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}>+ Add Pair</button>
        </div>
      )}

      {shape.type === 'multiple-choice' && (
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
      )}

      {shape.type === 'fill-in-the-blank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>CORRECT ANSWERS (COMMA SEPARATED)</label>
          <input type="text" value={item.answer.join(', ')} onChange={(e) => updateItem({ answer: e.target.value.split(',').map(s => s.trim()) })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} placeholder="goes, went" />
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Use ___ in the prompt to mark the blank space.</span>
        </div>
      )}
    </div>
  )
}