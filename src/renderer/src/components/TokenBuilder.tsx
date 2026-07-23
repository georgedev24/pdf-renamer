import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { KeyboardSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { FormatToken, TokenId } from '@shared/types'

// ── Available token definitions ───────────────────────────────────────────────
const AVAILABLE: Array<{ type: TokenId; label: string; color: string }> = [
  { type: 'DATE', label: '📅 ΗΜΕΡΟΜΗΝΙΑ', color: 'border-blue-500 text-blue-300 bg-blue-950' },
  { type: 'DOCTYPE', label: '📄 ΤΥΠΟΣ', color: 'border-purple-500 text-purple-300 bg-purple-950' },
  { type: 'SERIES', label: '🔤 ΣΕΙΡΑ', color: 'border-green-500 text-green-300 bg-green-950' },
  { type: 'DOCNUMBER', label: '# ΑΡΙΘΜΟΣ', color: 'border-yellow-500 text-yellow-300 bg-yellow-950' },
  { type: 'SUPPLIER', label: '🏢 ΠΡΟΜΗΘΕΥΤΗΣ', color: 'border-pink-500 text-pink-300 bg-pink-950' },
  { type: 'AMOUNT', label: '💰 ΠΟΣΟ', color: 'border-orange-500 text-orange-300 bg-orange-950' },
  { type: 'CUSTOM', label: '✏️ ΠΡΟΣΑΡΜΟΣΜΕΝΟ', color: 'border-gray-500 text-gray-300 bg-gray-800' }
]

const TOKEN_COLOR: Record<TokenId, string> = {
  DATE: 'border-blue-500 text-blue-300 bg-blue-950',
  DOCTYPE: 'border-purple-500 text-purple-300 bg-purple-950',
  SERIES: 'border-green-500 text-green-300 bg-green-950',
  DOCNUMBER: 'border-yellow-500 text-yellow-300 bg-yellow-950',
  SUPPLIER: 'border-pink-500 text-pink-300 bg-pink-950',
  AMOUNT: 'border-orange-500 text-orange-300 bg-orange-950',
  CUSTOM: 'border-gray-500 text-gray-300 bg-gray-800'
}

// ── Sortable chip ─────────────────────────────────────────────────────────────
function SortableChip({
  token,
  onRemove,
  onCustomTextChange
}: {
  token: FormatToken
  onRemove: () => void
  onCustomTextChange?: (text: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: token.id
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  const color = TOKEN_COLOR[token.type]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`token-chip ${color} border`}
    >
      {/* drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 pr-0.5"
        title="Σύρετε για αναδιάταξη"
      >
        ⠿
      </span>
      <span>{token.label}</span>
      {token.type === 'CUSTOM' && (
        <input
          className="ml-1 bg-transparent border-b border-gray-600 text-xs w-20 focus:outline-none focus:border-blue-400"
          placeholder="κείμενο…"
          value={token.customText ?? ''}
          onChange={(e) => onCustomTextChange?.(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}
      <button
        onClick={onRemove}
        className="ml-0.5 text-gray-500 hover:text-red-400 transition-colors text-xs leading-none"
        title="Αφαίρεση"
      >
        ✕
      </button>
    </div>
  )
}

// ── TokenBuilder ──────────────────────────────────────────────────────────────
interface Props {
  tokens: FormatToken[]
  separator: string
  onChange: (tokens: FormatToken[]) => void
  onSeparatorChange: (sep: string) => void
  preview?: string
}

export function TokenBuilder({ tokens, separator, onChange, onSeparatorChange, preview }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = tokens.findIndex((t) => t.id === active.id)
      const newIdx = tokens.findIndex((t) => t.id === over.id)
      onChange(arrayMove(tokens, oldIdx, newIdx))
    }
  }

  function addToken(type: TokenId, label: string) {
    const id = `tok-${type}-${Date.now()}`
    onChange([...tokens, { id, type, label }])
  }

  function removeToken(id: string) {
    onChange(tokens.filter((t) => t.id !== id))
  }

  function updateCustomText(id: string, text: string) {
    onChange(tokens.map((t) => (t.id === id ? { ...t, customText: text } : t)))
  }

  return (
    <div className="space-y-4">
      {/* Available tokens */}
      <div>
        <span className="label">Διαθέσιμα Πεδία — κλικ για προσθήκη</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {AVAILABLE.map((a) => (
            <button
              key={a.type}
              onClick={() => addToken(a.type, a.label)}
              className={`token-chip ${a.color} border hover:opacity-80`}
              title={`Προσθήκη πεδίου ${a.type}`}
            >
              {a.label}
              <span className="text-gray-400 text-xs">+</span>
            </button>
          ))}
        </div>
      </div>

      {/* Format zone */}
      <div>
        <span className="label">Μορφή — σύρετε για αναδιάταξη</span>
        <div className="min-h-[52px] bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tokens.map((t) => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              {tokens.map((tok, i) => (
                <div key={tok.id} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-gray-600 text-xs font-mono select-none">{separator}</span>
                  )}
                  <SortableChip
                    token={tok}
                    onRemove={() => removeToken(tok.id)}
                    onCustomTextChange={(t) => updateCustomText(tok.id, t)}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
          {tokens.length === 0 && (
            <span className="text-gray-600 text-sm italic">
              Χωρίς πεδία — κλικ παραπάνω για προσθήκη
            </span>
          )}
        </div>
      </div>

      {/* Separator + preview */}
      <div className="flex items-end gap-6">
        <div>
          <span className="label">Διαχωριστής</span>
          <input
            className="input w-16 text-center font-mono"
            maxLength={5}
            value={separator}
            onChange={(e) => onSeparatorChange(e.target.value)}
          />
        </div>
        {preview && (
          <div className="flex-1">
            <span className="label">Προεπισκόπηση</span>
            <div className="font-mono text-sm text-green-300 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 truncate">
              {preview}.pdf
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
