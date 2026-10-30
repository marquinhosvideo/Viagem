import { useState, type DragEvent, type FormEvent } from 'react'
import { GripVertical, MapPin, Plus, Trash2 } from 'lucide-react'
import type { DayPlace } from '../lib/dayMeta'
import { toDayPlace } from '../lib/dayMeta'
import { copyText } from '../lib/addresses'

type Props = {
  places: DayPlace[]
  /** When set, places can be added, removed and reordered. */
  onChange?: (places: DayPlace[]) => void
}

export function AddressCopyList({ places, onChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [addr, setAddr] = useState('')
  const editable = Boolean(onChange)

  if (!places.length && !editable) return null

  async function handleCopy(place: DayPlace) {
    const ok = await copyText(place.copyText)
    if (!ok) return
    setCopied(place.copyText)
    window.setTimeout(
      () => setCopied((c) => (c === place.copyText ? null : c)),
      1600,
    )
  }

  function reorder(from: number, to: number) {
    if (!onChange || from === to || from < 0 || to < 0 || to >= places.length) return
    const next = [...places]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  function handleDragStart(index: number, event: DragEvent) {
    setDragIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragOver(event: DragEvent) {
    if (!editable) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(index: number, event: DragEvent) {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isFinite(from)) reorder(from, index)
    setDragIndex(null)
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!onChange) return
    const place = toDayPlace(name, addr)
    if (!place) return
    onChange([...places, place])
    setName('')
    setAddr('')
  }

  function handleRemove(index: number) {
    if (!onChange) return
    onChange(places.filter((_, i) => i !== index))
  }

  return (
    <section className="band">
      <div className="band__inner">
        <h2 className="section-title">Endereços.</h2>
        <p className="section-sub">
          {editable
            ? 'Cada local é único. Arraste para ordenar e copie para o Waze.'
            : 'Copie e cole no Waze.'}
        </p>
        {places.length ? (
          <ul className="address-list">
            {places.map((place, index) => {
              const isCopied = copied === place.copyText
              return (
                <li
                  key={`${place.name}-${place.addr}-${index}`}
                  className={`address-card ${editable ? 'address-card--sortable' : ''} ${dragIndex === index ? 'address-card--dragging' : ''}`}
                  draggable={editable}
                  onDragStart={(event) => handleDragStart(index, event)}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(index, event)}
                  onDragEnd={() => setDragIndex(null)}
                >
                  {editable ? (
                    <span className="address-card__drag" aria-hidden>
                      <GripVertical size={18} />
                    </span>
                  ) : (
                    <MapPin size={18} aria-hidden className="address-card__pin" />
                  )}
                  <div className="address-card__text">
                    <p className="address-card__name">{place.name}</p>
                    <p className="address-card__addr">{place.addr}</p>
                  </div>
                  <div className="address-card__actions">
                    <button
                      type="button"
                      className="btn btn--pearl"
                      onClick={() => void handleCopy(place)}
                    >
                      {isCopied ? 'Copiado.' : 'Copiar'}
                    </button>
                    {editable ? (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => handleRemove(index)}
                        aria-label={`Remover ${place.name}`}
                        title="Remover"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty-hint">Nenhum local neste dia ainda.</p>
        )}

        {editable ? (
          <form className="address-add" onSubmit={handleAdd}>
            <h3>Adicionar local</h3>
            <div className="address-add__grid">
              <div className="field">
                <label htmlFor="place-name">Nome</label>
                <input
                  id="place-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Disney Springs"
                  maxLength={160}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="place-addr">Endereço</label>
                <input
                  id="place-addr"
                  value={addr}
                  onChange={(event) => setAddr(event.target.value)}
                  placeholder="Lake Buena Vista, FL 32830"
                  maxLength={300}
                />
              </div>
            </div>
            <button type="submit" className="btn btn--primary">
              <Plus size={18} aria-hidden />
              Adicionar local
            </button>
          </form>
        ) : null}
      </div>
    </section>
  )
}
