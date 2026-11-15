import { useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Tip, Trip } from '../types'
import { stripEmoji } from '../lib/display'
import { uid } from '../lib/format'
import { compressImageFile, normalizeTip } from '../lib/tips'

type Props = {
  trip: Trip
  onChange: (trip: Trip) => void | Promise<void>
}

type Draft = {
  tema: string
  texto: string
  photoUrl: string
  link: string
}

const emptyDraft = (): Draft => ({
  tema: '',
  texto: '',
  photoUrl: '',
  link: '',
})

export function TipsView({ trip, onChange }: Props) {
  const tips = trip.tips ?? []
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function upsertTip(next: Tip, replaceId?: string) {
    const without = (trip.tips ?? []).filter((tip) => tip.id !== (replaceId ?? next.id))
    void onChange({
      ...trip,
      tips: [next, ...without],
    })
  }

  function removeTip(id: string) {
    if (!window.confirm('Apagar esta dica?')) return
    void onChange({
      ...trip,
      tips: (trip.tips ?? []).filter((tip) => tip.id !== id),
    })
    if (editingId === id) setEditingId(null)
  }

  return (
    <section className="view">
      <section className="band band--parchment band--hero">
        <div className="band__inner">
          <p className="eyebrow">Dicas</p>
          <h1 className="display-lg">Produtos e serviços.</h1>
          <p className="lede">
            {tips.length
              ? `${tips.length} dicas para pesquisar e consumir ao longo da viagem.`
              : 'Ainda não há dicas. Adicione produtos e serviços com texto e foto.'}
          </p>
          {adding ? (
            <TipForm
              title="Nova dica."
              submitLabel="Salvar dica"
              initial={emptyDraft()}
              onCancel={() => setAdding(false)}
              onSave={(draft) => {
                const tip = draftToTip(draft)
                if (!tip) return
                upsertTip(tip)
                setAdding(false)
              }}
            />
          ) : (
            <button
              type="button"
              className="btn btn--primary tips-add-btn"
              onClick={() => {
                setEditingId(null)
                setAdding(true)
              }}
            >
              <Plus size={18} aria-hidden />
              Adicionar dica
            </button>
          )}
        </div>
      </section>

      {tips.length ? (
        <section className="band">
          <div className="band__inner tips-stack">
            {tips.map((tip) =>
              editingId === tip.id ? (
                <TipForm
                  key={tip.id}
                  title="Editar dica."
                  submitLabel="Salvar alterações"
                  initial={tipToDraft(tip)}
                  onCancel={() => setEditingId(null)}
                  onSave={(draft) => {
                    const next = draftToTip(draft, tip.id)
                    if (!next) return
                    upsertTip(next, tip.id)
                    setEditingId(null)
                  }}
                />
              ) : (
                <TipCard
                  key={tip.id}
                  tip={tip}
                  onEdit={() => {
                    setAdding(false)
                    setEditingId(tip.id)
                  }}
                  onRemove={() => removeTip(tip.id)}
                />
              ),
            )}
          </div>
        </section>
      ) : null}
    </section>
  )
}

function TipCard({
  tip,
  onEdit,
  onRemove,
}: {
  tip: Tip
  onEdit: () => void
  onRemove: () => void
}) {
  const tema = stripEmoji(tip.tema)
  const texto = stripEmoji(tip.texto)

  return (
    <article className="tip-card">
      {tip.photoUrl ? (
        <div className="tip-card__media">
          <img src={tip.photoUrl} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="tip-card__body">
        <div className="tip-card__head">
          <h2>{tema}</h2>
          <div className="tip-card__actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onEdit}
              aria-label={`Editar ${tema}`}
              title="Editar"
            >
              <Pencil size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={onRemove}
              aria-label={`Apagar ${tema}`}
              title="Apagar"
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
        </div>
        <p>{texto}</p>
        {tip.link ? (
          <a
            className="tip-card__link"
            href={tip.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden />
            Abrir link
          </a>
        ) : null}
      </div>
    </article>
  )
}

function TipForm({
  title,
  submitLabel,
  initial,
  onSave,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial: Draft
  onSave: (draft: Draft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.tema.trim() || !draft.texto.trim()) return
    onSave(draft)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    setCompressing(true)
    try {
      const photoUrl = await compressImageFile(file)
      setDraft((current) => ({ ...current, photoUrl }))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Falha ao processar a foto.')
    } finally {
      setCompressing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <form className="itinerary-editor tips-form" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <div className="field">
        <label htmlFor="tip-tema">Título</label>
        <input
          id="tip-tema"
          value={draft.tema}
          onChange={(event) => setDraft((d) => ({ ...d, tema: event.target.value }))}
          placeholder="Ex.: Cupons Premium Outlets"
          maxLength={160}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="tip-texto">Texto</label>
        <textarea
          id="tip-texto"
          value={draft.texto}
          onChange={(event) => setDraft((d) => ({ ...d, texto: event.target.value }))}
          placeholder="O que pesquisar, onde consumir, por que vale a pena…"
          maxLength={2000}
          rows={4}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="tip-photo-file">Foto</label>
        <input
          ref={fileRef}
          id="tip-photo-file"
          type="file"
          accept="image/*"
          onChange={(event) => void handleFile(event.target.files?.[0])}
          disabled={compressing}
        />
        <p className="field__hint">
          {compressing
            ? 'Comprimindo foto…'
            : 'Tirar ou escolher uma foto do produto/serviço. Também pode colar uma URL abaixo.'}
        </p>
        {photoError ? <p className="field__hint tip-form__error">{photoError}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="tip-photo-url">URL da foto</label>
        <input
          id="tip-photo-url"
          value={draft.photoUrl.startsWith('data:') ? '' : draft.photoUrl}
          onChange={(event) =>
            setDraft((d) => ({ ...d, photoUrl: event.target.value.trim() }))
          }
          placeholder="https://…"
          maxLength={500}
          inputMode="url"
        />
        {draft.photoUrl ? (
          <div className="tip-form__preview">
            <img src={draft.photoUrl} alt="" />
            <button
              type="button"
              className="btn btn--ghost-pill"
              onClick={() => setDraft((d) => ({ ...d, photoUrl: '' }))}
            >
              Remover foto
            </button>
          </div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="tip-link">Link para pesquisar</label>
        <input
          id="tip-link"
          value={draft.link}
          onChange={(event) => setDraft((d) => ({ ...d, link: event.target.value }))}
          placeholder="Opcional — site, loja ou Maps"
          maxLength={500}
          inputMode="url"
        />
      </div>
      <div className="itinerary-editor__actions">
        <button type="button" className="btn btn--ghost-pill" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={compressing}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function tipToDraft(tip: Tip): Draft {
  return {
    tema: tip.tema,
    texto: tip.texto,
    photoUrl: tip.photoUrl ?? '',
    link: tip.link ?? '',
  }
}

function draftToTip(draft: Draft, id = uid('tip')): Tip | null {
  return normalizeTip({
    id,
    tema: draft.tema,
    texto: draft.texto,
    photoUrl: draft.photoUrl || null,
    link: draft.link || null,
  })
}
