import { useState } from 'react'
import { CalendarDays, FerrisWheel, Home, MapPinned, Receipt, Upload } from 'lucide-react'
import type { TabId } from './types'
import { useAuth } from './hooks/useAuth'
import { useTrip } from './hooks/useTrip'
import { useViewportLayout } from './hooks/useViewportLayout'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthScreen } from './components/AuthScreen'
import { SetupBanner } from './components/SetupBanner'
import { SyncBadge } from './components/SyncBadge'
import { UpdatePasswordScreen } from './components/UpdatePasswordScreen'
import { TodayView } from './views/TodayView'
import { ItineraryView } from './views/ItineraryView'
import { ExpensesView } from './views/ExpensesView'
import { LocationsView } from './views/LocationsView'
import { ParksView } from './views/ParksView'
import { ImportView } from './views/ImportView'
import './App.css'

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'hoje', label: 'Hoje', icon: Home },
  { id: 'roteiro', label: 'Roteiro', icon: CalendarDays },
  { id: 'gastos', label: 'Gastos', icon: Receipt },
  { id: 'locais', label: 'Locais', icon: MapPinned },
  { id: 'parques', label: 'Parques', icon: FerrisWheel },
  { id: 'importar', label: 'Excel', icon: Upload },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('hoje')
  const [roteiroDayId, setRoteiroDayId] = useState<string | undefined>()
  const viewport = useViewportLayout()
  const auth = useAuth()
  const remoteEnabled = isSupabaseConfigured && Boolean(auth.session)
  const {
    trip,
    activeDay,
    syncState,
    syncError,
    replaceTrip,
    restoreTripSnapshot,
    resetToSample,
    toggleActivity,
    addExpense,
    removeExpense,
  } = useTrip(remoteEnabled)

  function selectTab(id: TabId) {
    setTab(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const shellClass = `app-shell app-shell--${viewport.device} app-shell--${viewport.aspect}`

  if (isSupabaseConfigured && !auth.ready) {
    return (
      <div className={shellClass}>
        <header className="global-nav">
          <p className="global-nav__brand">Orlando 2026</p>
        </header>
        <main className="app-main">
          <p className="muted">Carregando…</p>
        </main>
      </div>
    )
  }

  if (isSupabaseConfigured && !auth.session) {
    return (
      <div className={shellClass}>
        <AuthScreen
          error={auth.error}
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
        />
      </div>
    )
  }

  if (isSupabaseConfigured && auth.session && auth.needsPasswordReset) {
    return (
      <div className={shellClass}>
        <UpdatePasswordScreen
          email={auth.user?.email}
          onSubmit={auth.updatePassword}
        />
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <header className="global-nav">
        <p className="global-nav__brand">Orlando 2026</p>
      </header>

      <main className="app-main">
        {!isSupabaseConfigured ? <SetupBanner /> : null}

        <div className="sync-row">
          <SyncBadge
            state={syncState}
            error={syncError}
            email={auth.user?.email}
            onSignOut={isSupabaseConfigured ? () => void auth.signOut() : undefined}
          />
        </div>

        {tab === 'hoje' && activeDay ? (
          <TodayView trip={trip} day={activeDay} onToggle={toggleActivity} />
        ) : null}
        {tab === 'roteiro' ? (
          <ItineraryView
            trip={trip}
            initialDayId={roteiroDayId ?? activeDay?.id}
            focusDayId={roteiroDayId}
            onToggle={toggleActivity}
            onChange={restoreTripSnapshot}
          />
        ) : null}
        {tab === 'gastos' && activeDay ? (
          <ExpensesView
            trip={trip}
            defaultDayId={activeDay.id}
            onAdd={addExpense}
            onRemove={removeExpense}
          />
        ) : null}
        {tab === 'locais' ? (
          <LocationsView
            trip={trip}
            onOpenDay={(dayId) => {
              setRoteiroDayId(dayId)
              selectTab('roteiro')
            }}
          />
        ) : null}
        {tab === 'parques' ? <ParksView trip={trip} /> : null}
        {tab === 'importar' ? (
          <ImportView
            trip={trip}
            onImported={async (next) => {
              const checkMap = new Map<string, boolean>()
              for (const day of trip.days) {
                for (const act of day.activities) checkMap.set(act.id, act.done)
              }
              await replaceTrip({
                ...next,
                expenses: trip.expenses,
                days: next.days.map((day) => ({
                  ...day,
                  activities: day.activities.map((act) => ({
                    ...act,
                    done: checkMap.get(act.id) ?? act.done,
                  })),
                })),
              })
            }}
            onReset={resetToSample}
            onRestore={restoreTripSnapshot}
          />
        ) : null}
      </main>

      <nav className="tab-bar" aria-label="Navegação principal">
        <div className="tab-bar__inner">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                className={`tab-bar__btn ${active ? 'tab-bar__btn--active' : ''}`}
                onClick={() => selectTab(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                data-tab={id}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
