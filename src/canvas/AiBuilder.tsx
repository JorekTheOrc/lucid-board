import { useState, useEffect } from 'react'
import type { Editor } from 'tldraw'
import type { Item } from '../types/exercise'

interface Props {
  editor: Editor
  onClose: () => void
}

interface PlanRow {
  id: string
  type: 'multiple-choice' | 'fill-in-the-blank' | 'true-false' | 'rich-text' | 'matching'
  topic: string
  count: string | number
}

interface Template {
  id: string
  name: string
  text: string
  plans?: PlanRow[]
}

// --- БЕЗОПАСНЫЙ ПАРСЕР JSON ---
function parseJsonSafe(text: string) {
  try { return JSON.parse(text); } catch (firstErr) {
    let insideString = false, escaped = false, fixed = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], code = text.charCodeAt(i);
      if (escaped) { fixed += ch; escaped = false; continue; }
      if (ch === '\\') { fixed += ch; escaped = true; continue; }
      if (ch === '"') { insideString = !insideString; fixed += ch; continue; }
      if (insideString) {
        if (ch === '\n') { fixed += ' '; continue; }
        if (ch === '\r') { continue; }
        if (ch === '\t') { fixed += ' '; continue; }
        if (code < 0x20) { continue; }
      }
      fixed += ch;
    }
    fixed = fixed.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').replace(/\uFEFF/g, '');
    try { return JSON.parse(fixed); } catch (secondErr) { throw new Error('JSON не удалось разобрать даже после чистки. ' + (firstErr as Error).message); }
  }
}

export function AiBuilder({ editor, onClose }: Props) {
  const [plans, setPlans] = useState<PlanRow[]>([
    { id: crypto.randomUUID(), type: 'multiple-choice', topic: '', count: 5 }
  ])
  
  const [context, setContext] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const [jsonText, setJsonText] = useState('')
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null)
  
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const saved = localStorage.getItem('lucid_board_ai_templates')
    if (saved) { try { setTemplates(JSON.parse(saved)) } catch (e) {} }
  }, [])

  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates)
    localStorage.setItem('lucid_board_ai_templates', JSON.stringify(newTemplates))
  }

  const addPlanRow = () => {
    const last = plans[plans.length - 1] || plans[0] || { type: 'multiple-choice', topic: '', count: 5 }
    setPlans([...plans, { id: crypto.randomUUID(), type: last.type, topic: last.topic, count: last.count }])
  }

  const updatePlanRow = (id: string, field: keyof PlanRow, value: any) => {
    setPlans(plans.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const removePlanRow = (id: string) => {
    setPlans(plans.filter(p => p.id !== id))
  }

  const generatePrompt = () => {
    const plansText = plans.map((p, i) => {
      const numCount = Number(p.count) || 1
      return `${i + 1}. Type: "${p.type}", Topic: "${p.topic}", Number of items: ${numCount}`
    }).join('\n')

    return `You are an English teacher. Generate a single JSON array containing multiple exercises based on this plan:
${plansText}

${context ? `Additional context/rules:\n${context}\n` : ''}

CRITICAL JSON RULES:
- NEVER use double quotes (") inside a string value. Use single quotes (') instead.
- Do not put real newlines inside strings; keep each string on one line.
- Return ONLY valid JSON. No markdown, no comments, no text before or after.

QUALITY CHECK:
Make sure to double check, proof read and verify every exercise you create.
The exercises must NOT contain: illogical matches, right answers appearing inside the question text, unfinished sentences, duplicated options/pairs, multiple correct options for single-choice, grammatical errors.

Each exercise object must strictly follow one of these schemas:

For "multiple-choice":
{
  "type": "multiple-choice",
  "items": [
    { "id": "1", "prompt": "She ___ to school.", "options": [ { "id": "o1", "text": "go" }, { "id": "o2", "text": "goes" } ], "answer": ["goes"] }
  ]
}

For "fill-in-the-blank":
{
  "type": "fill-in-the-blank",
  "items": [
    { "id": "1", "prompt": "She ___ to school.", "answer": ["goes"] }
  ]
}

For "true-false":
{
  "type": "true-false",
  "items": [
    { "id": "1", "prompt": "She goes to school.", "answer": ["true"] }
  ]
}

For "matching":
{
  "type": "matching",
  "items": [
    { "id": "1", "prompt": "Match the pairs", "pairs": [ {"left": "Dog", "right": "Собака"}, {"left": "Cat", "right": "Кошка"} ] }
  ]
}

For "rich-text" (use HTML tags like <p>, <h2>, <ul> inside the prompt):
{
  "type": "rich-text",
  "items": [
    { "id": "1", "prompt": "<h2>Title</h2><p>Long text goes here...</p>" }
  ]
}

Ensure the number of items matches the requested count for each exercise.`
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatePrompt())
    showToast('Prompt copied to clipboard!', 'success')
  }

  const handleGenerate = () => {
    try {
      const data = parseJsonSafe(jsonText)
      const exercises = Array.isArray(data) ? data : (data.exercises || [data])

      if (exercises.length === 0) throw new Error("No exercises found in JSON")

      const center = editor.getViewportPageBounds().center
      let textX = center.x - 500, textY = center.y - 300
      let exerciseX = center.x + 50, exerciseY = center.y - 300
      let hasContent = false

      exercises.forEach((ex: any) => {
        if (!ex.items || !Array.isArray(ex.items) || ex.items.length === 0) return;

        if (ex.type === 'rich-text') {
           const combinedHtml = ex.items.map((rtItem: any) => rtItem.prompt || '').join('')
           editor.createShape({ type: 'rich-text', x: textX, y: textY, props: { w: 500, h: 200, content: combinedHtml } })
           textY += 250
           hasContent = true
        } else {
          // ЖЕСТКАЯ СБОРКА ОБЪЕКТОВ (защита от лишних свойств от ИИ)
          const items: Item[] = ex.items.map((item: any) => {
            const base = {
              id: crypto.randomUUID(),
              prompt: item.prompt || '',
              answer: item.answer || []
            }
            
            if (ex.type === 'multiple-choice' || ex.type === 'true-false') {
              return {
                ...base,
                options: (item.options || []).map((opt: any) => ({ id: crypto.randomUUID(), text: opt.text })),
                answer: ex.type === 'true-false' ? [(item.answer?.[0] === 'true' || item.answer?.[0] === true) ? 'True' : 'False'] : base.answer
              }
            } else if (ex.type === 'matching') {
              return {
                ...base,
                pairs: (item.pairs || []).map((p: any) => ({ left: p.left, right: p.right }))
              }
            } else {
              return base
            }
          })

          if (ex.type === 'multiple-choice' || ex.type === 'true-false') {
            const isTF = ex.type === 'true-false'
            const finalItems = isTF ? items.map(i => ({ ...i, options: [{ id: 't', text: 'True' }, { id: 'f', text: 'False' }] })) : items
            editor.createShape({ type: 'multiple-choice', x: exerciseX, y: exerciseY, props: { w: 500, h: 500, items: finalItems, selectedIndices: items.map(() => null), confirmedIndices: items.map(() => false), currentIndex: 0 } })
            exerciseY += 550; hasContent = true
          } else if (ex.type === 'fill-in-the-blank') {
            editor.createShape({ type: 'fill-in-the-blank', x: exerciseX, y: exerciseY, props: { w: 500, h: 300, items, userInputs: items.map(() => ''), confirmedIndices: items.map(() => false), currentIndex: 0 } })
            exerciseY += 350; hasContent = true
          } else if (ex.type === 'matching') {
            const pairs = items[0].pairs || []
            const shuffledRight = pairs.map((p: any) => p.right).sort(() => Math.random() - 0.5)
            editor.createShape({ type: 'matching', x: exerciseX, y: exerciseY, props: { w: 500, h: 300, items, currentIndex: 0, matchedPairs: {}, shuffledRight, selectedLeft: null } })
            exerciseY += 350; hasContent = true
          }
        }
      })

      if (!hasContent) throw new Error("No valid exercises with items were found in the JSON.")
      onClose()
    } catch (err: any) {
      showToast(err.message || 'Invalid JSON format', 'error')
    }
  }

  const applyTemplate = (tpl: Template) => {
    setContext(tpl.text)
    if (tpl.plans) {
      setPlans(tpl.plans.map(p => ({ ...p, id: crypto.randomUUID() })))
    }
  }

  const deleteTemplate = (id: string) => saveTemplates(templates.filter(t => t.id !== id))

  const handleSaveTemplate = () => {
    if (!templateName.trim()) { showToast('Enter a template name first', 'error'); return; }
    if (!context.trim() && plans.length === 1 && !plans[0].topic) { showToast('Context and plan are empty', 'error'); return; }
    const newTemplate = { id: crypto.randomUUID(), name: templateName, text: context, plans: JSON.parse(JSON.stringify(plans)) }
    saveTemplates([...templates, newTemplate])
    setTemplateName('')
    setShowSaveInput(false)
    showToast('Template saved!', 'success')
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {toast && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '8px', color: 'white', fontWeight: 'bold', backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 3000 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>✨ AI Studio</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>1. Exercise Plans</label>
          {plans.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={p.type} onChange={e => updatePlanRow(p.id, 'type', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <option value="multiple-choice">Multiple Choice</option>
                <option value="fill-in-the-blank">Fill in the Blank</option>
                <option value="true-false">True / False</option>
                <option value="matching">Matching</option>
                <option value="rich-text">Rich Text (Reading)</option>
              </select>
              <input type="text" value={p.topic} onChange={e => updatePlanRow(p.id, 'topic', e.target.value)} placeholder="Topic..." style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              <input type="number" value={p.count} onChange={e => updatePlanRow(p.id, 'count', e.target.value)} min="1" max="20" style={{ width: '60px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              <button onClick={() => removePlanRow(p.id)} style={{ padding: '8px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={addPlanRow} style={{ padding: '8px', backgroundColor: '#f3f4f6', border: '1px dashed #9ca3af', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Exercise to Plan</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>2. Additional Context</label>
            <button onClick={() => setShowSaveInput(!showSaveInput)} style={{ fontSize: '12px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>+ Save as Template</button>
          </div>
          
          {showSaveInput && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (saves plan + text)..." style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
              <button onClick={handleSaveTemplate} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
            </div>
          )}

          <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Level B1, focus on irregular verbs..." style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'sans-serif', fontSize: '13px' }} />
          
          {templates.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {templates.map(t => (
                <div key={t.id} onClick={() => applyTemplate(t)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', border: '1px solid #bfdbfe' }}>
                  {t.name}
                  <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', marginLeft: '4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
          <button onClick={handleCopyPrompt} style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Copy AI Prompt
          </button>
          
          <label style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>3. Paste JSON from AI</label>
          <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder='[ { "type": "multiple-choice", "items": [...] } ]' style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '12px' }} />
        </div>

        <button onClick={handleGenerate} disabled={!jsonText} style={{ padding: '12px', backgroundColor: jsonText ? '#10b981' : '#9ca3af', color: 'white', border: 'none', borderRadius: '6px', cursor: jsonText ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '16px' }}>
          Generate Exercises on Board
        </button>
      </div>
    </div>
  )
}