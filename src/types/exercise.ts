export type ExerciseType =
  | 'multiple_choice'
  | 'true_false'
  | 'true_false_ng'
  | 'sentence_completion'
  | 'fill_blank'
  | 'matching'
  | 'ordering'
  | 'short_answer'
  | 'translation'

export interface VocabItem {
  text: string
  translation: string
}

export interface Option {
  id: string
  text: string
  vocabulary?: VocabItem[]
}

export interface Item {
  id: string
  prompt?: string
  vocabulary?: VocabItem[]
  options?: Option[]
  answer: (string | boolean)[]
  hint?: string
  translation?: string
  explanation?: string
  word_limit?: number
  word_box?: string[]
  pairs?: { left: string; right: string }[]
  tokens?: string[]
  correct_order?: string[]
  alternatives?: string[]
}

export interface Exercise {
  id: string
  set_id: string
  type: ExerciseType
  title: string
  instruction: string
  tags?: string[]
  items: Item[]
}

export interface Progress {
  id: string
  set_id: string
  item_id: string
  correct: boolean
  used_hint: boolean
  used_translation: boolean
  viewed_vocabulary?: string[]
  timestamp: number
  duration_ms: number
}