import { useState, type DragEvent } from 'react'
import { Check, Clock, GripVertical, MapPin, Pencil, Trash2 } from 'lucide-react'
import type { Activity } from '../types'
import { copyText } from '../lib/addresses'
import { parseActivityLines } from '../lib/display'

type Props = {
  activity: Activity
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  draggable?: boolean
  onDragStart?: (event: DragEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
  onDragEnd?: () => void
  dragging?: boolean
}

export function ActivityItem({
  activity,
  onToggle,
  onEdit,
  onDelete,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragging = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const source = activity.notes || activity.title
  const lines = parseActivityLines(source)
  const headline = lines[0]?.text || activity.title
  const cats = lines.filter((l) => l.cat)
  const hasDetails = lines.length > 1

  async function handleCopyAddress() {
    if (!activity.location) return
    const ok = await copyText(activity.location)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <article
      className={`activity ${activity.done ? 'activity--done' : ''} ${dragging ? 'activity--dragging' : ''} ${draggable ? 'activity--sortable' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="activity__row">
        {draggable ? (
          <span className="activity__drag" aria-hidden title="Arrastar para reordenar">
            <GripVertical size={18} />
          </span>
        ) : null}

        <button
          type="button"
          className="activity__check-btn"
          onClick={onToggle}
          aria-pressed={activity.done}
          aria-label="Concluir evento"
        >
          <span className="activity__check" aria-hidden>
            <Check size={16} strokeWidth={2.5} />
          </span>
        </button>

        <div className="activity__body">
          <div className="activity__meta">
            {activity.time ? (
              <span className="activity__time">
                <Clock size={16} aria-hidden />
                {activity.time}
              </span>
            ) : (
              <span className="activity__time activity__time--muted">Evento</span>
            )}
            {onEdit || onDelete ? (
              <span className="activity__actions">
                {onEdit ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={onEdit}
                    aria-label={`Editar ${headline}`}
                    title="Editar"
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={onDelete}
                    aria-label={`Excluir ${headline}`}
                    title="Excluir"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
          <p className="activity__title">{headline}</p>
          {cats.length > 0 ? (
            <div className="activity__cats">
              {cats.map((cat) => {
                const Icon = cat.icon
                return (
                  <span key={`${cat.cat}-${cat.text.slice(0, 12)}`} className="activity__cat">
                    <Icon size={14} aria-hidden />
                    {cat.cat}
                  </span>
                )
              })}
            </div>
          ) : null}

          {activity.location ? (
            <div className="activity__address activity__address--inline">
              <div className="activity__address-text">
                <MapPin size={18} aria-hidden />
                <p>{activity.location}</p>
              </div>
              <button
                type="button"
                className="btn btn--pearl"
                onClick={() => void handleCopyAddress()}
              >
                {copied ? 'Copiado.' : 'Copiar'}
              </button>
            </div>
          ) : null}

          {hasDetails ? (
            <button
              type="button"
              className="text-link"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Ocultar detalhes' : 'Detalhes ›'}
            </button>
          ) : null}

          {expanded ? (
            <div className="activity__details">
              {lines.map((line, i) => {
                const Icon = line.icon
                return (
                  <div key={`${i}-${line.text.slice(0, 20)}`} className="activity__detail-row">
                    <Icon size={18} aria-hidden />
                    <div>
                      {line.cat ? <p className="activity__detail-cat">{line.cat}</p> : null}
                      <p className="activity__detail-text">{line.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
