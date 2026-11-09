import { useState, type DragEvent } from 'react'
import {
  Check,
  ExternalLink,
  GripVertical,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { Place, Stop } from '../types'
import { copyText } from '../lib/addresses'
import {
  hasAddress,
  mapsSearchQuery,
  PLACE_CATEGORY_ICONS,
  placeCategoryLabel,
} from '../lib/places'

type Props = {
  stop: Stop
  place?: Place
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
  stop,
  place,
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
  const [copied, setCopied] = useState(false)
  const optional = stop.status === 'opcional'
  const category = place?.category
  const CategoryIcon = category ? PLACE_CATEGORY_ICONS[category] : MapPin
  const address = place?.address?.trim() || ''
  const canOpenMap = hasAddress(place)

  async function handleCopyAddress() {
    if (!place) return
    const text = address ? `${place.name} – ${address}` : place.name
    const ok = await copyText(text)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <article
      className={[
        'activity',
        'stop',
        stop.done ? 'activity--done' : '',
        optional ? 'stop--optional' : '',
        dragging ? 'activity--dragging' : '',
        draggable ? 'activity--sortable' : '',
        category ? `stop--${category}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
          aria-pressed={stop.done}
          aria-label="Concluir parada"
        >
          <span className="activity__check" aria-hidden>
            <Check size={16} strokeWidth={2.5} />
          </span>
        </button>

        <div className="activity__body">
          <div className="activity__meta">
            <span className="activity__time stop__order">
              {stop.orderInDay}º
            </span>
            {category ? (
              <span className={`stop__category stop__category--${category}`}>
                <CategoryIcon size={14} aria-hidden />
                {placeCategoryLabel(category)}
              </span>
            ) : null}
            {optional ? <span className="stop__badge">Opcional</span> : null}
            {onEdit || onDelete ? (
              <span className="activity__actions">
                {onEdit ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={onEdit}
                    aria-label={`Editar ${place?.name ?? 'parada'}`}
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
                    aria-label={`Excluir ${place?.name ?? 'parada'}`}
                    title="Excluir"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>

          <p className="activity__title">{place?.name ?? 'Local'}</p>

          {address ? (
            <div className="activity__address activity__address--inline">
              <div className="activity__address-text">
                <MapPin size={18} aria-hidden />
                <p>{address}</p>
              </div>
              <button
                type="button"
                className="btn btn--pearl"
                onClick={() => void handleCopyAddress()}
              >
                {copied ? 'Copiado.' : 'Copiar'}
              </button>
            </div>
          ) : (
            <p className="stop__no-address muted">Endereço a completar</p>
          )}

          {stop.note ? <p className="stop__note">{stop.note}</p> : null}

          {canOpenMap && place ? (
            <a
              className="text-link stop__map-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsSearchQuery(place))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no mapa
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}
